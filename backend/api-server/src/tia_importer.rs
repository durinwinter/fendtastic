use anyhow::{Context, Result};
use quick_xml::events::Event;
use quick_xml::Reader;
use shared::domain::driver::{DriverDataType, DriverTag, TagAccess, TagGroup};
use std::collections::HashMap;

/// A single tag parsed from a TIA Portal export file.
#[derive(Debug, Clone)]
pub struct TiaTag {
    pub name: String,
    pub data_type: String,
    pub address: String,
    pub comment: Option<String>,
    pub table_name: Option<String>,
    pub hmi_writeable: Option<bool>,
}

/// Auto-detect format by filename extension and parse.
pub fn parse_tia_file(filename: &str, content: &[u8]) -> Result<Vec<TiaTag>> {
    let lower = filename.to_lowercase();
    if lower.ends_with(".xlsx") || lower.ends_with(".xls") {
        parse_xlsx(content)
    } else if lower.ends_with(".xml") {
        parse_xml(content)
    } else if lower.ends_with(".csv") || lower.ends_with(".txt") || lower.ends_with(".tsv") {
        parse_csv(content)
    } else {
        // Try XLSX first, then XML, then CSV
        parse_xlsx(content)
            .or_else(|_| parse_xml(content))
            .or_else(|_| parse_csv(content))
    }
}

/// Parse a TIA Portal XLSX export (e.g. PLCTags.xlsx).
///
/// Expected columns (case-insensitive):
///   Name, Path, Data Type, Logical Address, Comment, Hmi Writeable
fn parse_xlsx(content: &[u8]) -> Result<Vec<TiaTag>> {
    use calamine::{Reader as XlsxReader, Xlsx, open_workbook_from_rs};
    use std::io::Cursor;

    let cursor = Cursor::new(content);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| anyhow::anyhow!("Failed to open XLSX: {}", e))?;

    let mut tags = Vec::new();

    for sheet_name in workbook.sheet_names().to_vec() {
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| anyhow::anyhow!("Failed to read sheet '{}': {}", sheet_name, e))?;

        let mut rows = range.rows();
        let header_row = match rows.next() {
            Some(row) => row,
            None => continue,
        };

        // Map column indices by header name (case-insensitive)
        let headers: Vec<String> = header_row
            .iter()
            .map(|c| c.to_string().trim().to_lowercase())
            .collect();

        let name_idx = headers.iter().position(|h| h == "name");
        let path_idx = headers.iter().position(|h| h == "path");
        let type_idx = headers
            .iter()
            .position(|h| h == "data type" || h == "datatype" || h == "data_type");
        let addr_idx = headers
            .iter()
            .position(|h| h == "logical address" || h == "address" || h == "logicaladdress");
        let comment_idx = headers.iter().position(|h| h == "comment" || h == "description");
        let writable_idx = headers
            .iter()
            .position(|h| h == "hmi writeable" || h == "hmi writable");

        let name_idx = match name_idx {
            Some(i) => i,
            None => continue, // skip sheets without a Name column
        };
        let addr_idx = match addr_idx {
            Some(i) => i,
            None => continue,
        };

        for row in rows {
            let name = row.get(name_idx).map(|c| c.to_string()).unwrap_or_default();
            let name = name.trim().to_string();
            if name.is_empty() {
                continue;
            }

            let address = row.get(addr_idx).map(|c| c.to_string()).unwrap_or_default();
            let address = address.trim().to_string();
            if address.is_empty() {
                continue;
            }

            let data_type = type_idx
                .and_then(|i| row.get(i))
                .map(|c| c.to_string().trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "Bool".to_string());

            let comment = comment_idx
                .and_then(|i| row.get(i))
                .map(|c| c.to_string().trim().to_string())
                .filter(|s| !s.is_empty());

            let table_name = path_idx
                .and_then(|i| row.get(i))
                .map(|c| c.to_string().trim().to_string())
                .filter(|s| !s.is_empty());

            let hmi_writeable = writable_idx.and_then(|i| row.get(i)).map(|c| {
                let s = c.to_string().trim().to_lowercase();
                s == "true" || s == "1" || s == "yes"
            });

            tags.push(TiaTag {
                name,
                data_type,
                address,
                comment,
                table_name,
                hmi_writeable,
            });
        }
    }

    if tags.is_empty() {
        anyhow::bail!("No PLC tags found in XLSX file");
    }

    Ok(tags)
}

/// Parse TIA Portal Openness XML export.
///
/// Expected structure:
/// ```xml
/// <Document>
///   <SW.Tags.PlcTagTable>
///     <AttributeList><Name>TableName</Name></AttributeList>
///     <ObjectList>
///       <SW.Tags.PlcTag>
///         <AttributeList>
///           <Name>TagName</Name>
///           <DataTypeName>Bool</DataTypeName>
///           <LogicalAddress>%I0.0</LogicalAddress>
///           <Comment><MultiLanguageText Lang="en-US">desc</MultiLanguageText></Comment>
///         </AttributeList>
///       </SW.Tags.PlcTag>
///     </ObjectList>
///   </SW.Tags.PlcTagTable>
/// </Document>
/// ```
fn parse_xml(content: &[u8]) -> Result<Vec<TiaTag>> {
    let mut reader = Reader::from_reader(content);
    reader.config_mut().trim_text(true);

    let mut tags = Vec::new();
    let mut buf = Vec::new();

    let mut current_table_name: Option<String> = None;
    let mut in_tag_table = false;
    let mut in_plc_tag = false;
    let mut in_attribute_list = false;
    let mut current_element = String::new();
    let mut in_comment = false;

    let mut tag_name: Option<String> = None;
    let mut tag_data_type: Option<String> = None;
    let mut tag_address: Option<String> = None;
    let mut tag_comment: Option<String> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Eof) => break,
            Ok(Event::Start(ref e)) => {
                let local = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match local.as_str() {
                    "SW.Tags.PlcTagTable" | "PlcTagTable" => {
                        in_tag_table = true;
                    }
                    "SW.Tags.PlcTag" | "PlcTag" => {
                        in_plc_tag = true;
                        tag_name = None;
                        tag_data_type = None;
                        tag_address = None;
                        tag_comment = None;
                    }
                    "AttributeList" => {
                        in_attribute_list = true;
                    }
                    "Comment" => {
                        in_comment = true;
                    }
                    "Name" | "DataTypeName" | "LogicalAddress" | "MultiLanguageText" => {
                        current_element = local;
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let local = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match local.as_str() {
                    "SW.Tags.PlcTagTable" | "PlcTagTable" => {
                        in_tag_table = false;
                        current_table_name = None;
                    }
                    "SW.Tags.PlcTag" | "PlcTag" => {
                        if let (Some(name), Some(addr)) = (tag_name.take(), tag_address.take()) {
                            tags.push(TiaTag {
                                name,
                                data_type: tag_data_type
                                    .take()
                                    .unwrap_or_else(|| "Bool".to_string()),
                                address: addr,
                                comment: tag_comment.take(),
                                table_name: current_table_name.clone(),
                                hmi_writeable: None,
                            });
                        }
                        in_plc_tag = false;
                    }
                    "AttributeList" => {
                        in_attribute_list = false;
                    }
                    "Comment" => {
                        in_comment = false;
                    }
                    _ => {}
                }
                current_element.clear();
            }
            Ok(Event::Text(ref e)) => {
                if !in_attribute_list {
                    continue;
                }
                let text = e.unescape().unwrap_or_default().to_string();
                if text.is_empty() {
                    continue;
                }

                if in_plc_tag {
                    match current_element.as_str() {
                        "Name" => tag_name = Some(text),
                        "DataTypeName" => tag_data_type = Some(text),
                        "LogicalAddress" => tag_address = Some(text),
                        "MultiLanguageText" if in_comment => tag_comment = Some(text),
                        _ => {}
                    }
                } else if in_tag_table && current_element == "Name" {
                    current_table_name = Some(text);
                }
            }
            Err(e) => return Err(anyhow::anyhow!("XML parse error: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    if tags.is_empty() {
        anyhow::bail!("No PLC tags found in XML file");
    }

    Ok(tags)
}

/// Parse a tab- or semicolon-delimited CSV export.
///
/// Expected header (case-insensitive): Name, Path, Data Type, Logical Address, Comment
/// Delimiter auto-detected: tab, semicolon, or comma.
fn parse_csv(content: &[u8]) -> Result<Vec<TiaTag>> {
    let text = String::from_utf8_lossy(content);
    let mut lines = text.lines().filter(|l| !l.trim().is_empty());

    let header = lines.next().context("CSV file is empty")?;

    let delimiter = if header.contains('\t') {
        '\t'
    } else if header.contains(';') {
        ';'
    } else {
        ','
    };

    let columns: Vec<String> = header
        .split(delimiter)
        .map(|s| s.trim().to_lowercase())
        .collect();

    let name_idx = columns
        .iter()
        .position(|c| c == "name")
        .context("CSV missing 'Name' column")?;
    let path_idx = columns.iter().position(|c| c == "path");
    let type_idx = columns
        .iter()
        .position(|c| c == "data type" || c == "datatype" || c == "data_type" || c == "type");
    let addr_idx = columns
        .iter()
        .position(|c| {
            c == "address" || c == "logical address" || c == "logicaladdress"
        })
        .context("CSV missing 'Address' or 'Logical Address' column")?;
    let comment_idx = columns
        .iter()
        .position(|c| c == "comment" || c == "description");
    let writable_idx = columns
        .iter()
        .position(|c| c == "hmi writeable" || c == "hmi writable");

    let mut tags = Vec::new();

    for line in lines {
        let fields: Vec<&str> = line.split(delimiter).collect();
        let name = fields.get(name_idx).map(|s| s.trim()).unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let address = fields.get(addr_idx).map(|s| s.trim()).unwrap_or_default();
        if address.is_empty() {
            continue;
        }

        let data_type = type_idx
            .and_then(|i| fields.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Bool".to_string());

        let comment = comment_idx
            .and_then(|i| fields.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let table_name = path_idx
            .and_then(|i| fields.get(i))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let hmi_writeable = writable_idx.and_then(|i| fields.get(i)).map(|s| {
            let s = s.trim().to_lowercase();
            s == "true" || s == "1" || s == "yes"
        });

        tags.push(TiaTag {
            name: name.to_string(),
            data_type,
            address: address.to_string(),
            comment,
            table_name,
            hmi_writeable,
        });
    }

    if tags.is_empty() {
        anyhow::bail!("No tags found in CSV file");
    }

    Ok(tags)
}

/// Strip TIA address prefix (%) to get native S7 address.
/// `%I0.0` → `I0.0`, `%MW10` → `MW10`, `I0.0` → `I0.0` (already clean)
fn normalize_address(addr: &str) -> String {
    addr.strip_prefix('%').unwrap_or(addr).to_string()
}

/// Map TIA Portal data type names to our DriverDataType.
fn map_data_type(tia_type: &str) -> DriverDataType {
    match tia_type.to_lowercase().as_str() {
        "bool" => DriverDataType::Bool,
        "int" | "sint" => DriverDataType::Int16,
        "uint" | "usint" | "byte" | "word" => DriverDataType::Uint16,
        "dint" => DriverDataType::Int32,
        "udint" | "dword" => DriverDataType::Uint32,
        "real" => DriverDataType::Float32,
        "lreal" => DriverDataType::Float64,
        _ => DriverDataType::String,
    }
}

/// Infer read/write access from the address area and optional HMI writeable flag.
fn infer_access(address: &str, hmi_writeable: Option<bool>) -> TagAccess {
    let normalized = normalize_address(address).to_uppercase();
    if normalized.starts_with('I') {
        // Physical inputs are read-only regardless of HMI flag
        TagAccess::Read
    } else if let Some(false) = hmi_writeable {
        // Explicitly marked not writeable
        TagAccess::Read
    } else {
        TagAccess::ReadWrite
    }
}

/// Generate a stable tag ID from the tag name.
fn slugify(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

/// Convert parsed TIA tags into TagGroups.
///
/// Groups by `table_name` (Path column) if present, otherwise by address area.
pub fn to_tag_groups(tags: Vec<TiaTag>) -> Vec<TagGroup> {
    let mut groups: HashMap<String, Vec<DriverTag>> = HashMap::new();

    for tag in tags {
        let address = normalize_address(&tag.address);
        let group_name = tag.table_name.clone().unwrap_or_else(|| {
            let upper = address.to_uppercase();
            if upper.starts_with('I') {
                "Inputs".to_string()
            } else if upper.starts_with('Q') {
                "Outputs".to_string()
            } else if upper.starts_with('M') {
                "Markers".to_string()
            } else if upper.starts_with("DB") {
                "Data Blocks".to_string()
            } else {
                "Other".to_string()
            }
        });

        let mut attributes = serde_json::Map::new();
        if let Some(comment) = &tag.comment {
            attributes.insert(
                "description".to_string(),
                serde_json::Value::String(comment.clone()),
            );
        }

        let driver_tag = DriverTag {
            id: slugify(&tag.name),
            name: tag.name,
            address,
            data_type: map_data_type(&tag.data_type),
            access: infer_access(&tag.address, tag.hmi_writeable),
            scan_ms: None,
            attributes: serde_json::Value::Object(attributes),
        };

        groups.entry(group_name).or_default().push(driver_tag);
    }

    let mut result: Vec<TagGroup> = groups
        .into_iter()
        .map(|(name, tags)| {
            let id = slugify(&name);
            TagGroup {
                id,
                name,
                description: None,
                tags,
            }
        })
        .collect();

    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_address() {
        assert_eq!(normalize_address("%I0.0"), "I0.0");
        assert_eq!(normalize_address("%MW10"), "MW10");
        assert_eq!(normalize_address("%DB1.DBW0"), "DB1.DBW0");
        assert_eq!(normalize_address("I0.0"), "I0.0");
    }

    #[test]
    fn test_map_data_type() {
        assert!(matches!(map_data_type("Bool"), DriverDataType::Bool));
        assert!(matches!(map_data_type("Int"), DriverDataType::Int16));
        assert!(matches!(map_data_type("DInt"), DriverDataType::Int32));
        assert!(matches!(map_data_type("Real"), DriverDataType::Float32));
        assert!(matches!(map_data_type("LReal"), DriverDataType::Float64));
        assert!(matches!(map_data_type("Word"), DriverDataType::Uint16));
        assert!(matches!(map_data_type("DWord"), DriverDataType::Uint32));
    }

    #[test]
    fn test_infer_access() {
        assert_eq!(infer_access("%I0.0", None), TagAccess::Read);
        assert_eq!(infer_access("%Q0.0", None), TagAccess::ReadWrite);
        assert_eq!(infer_access("%MW10", None), TagAccess::ReadWrite);
        assert_eq!(infer_access("%MW10", Some(false)), TagAccess::Read);
        assert_eq!(infer_access("%MW10", Some(true)), TagAccess::ReadWrite);
        assert_eq!(infer_access("%I0.0", Some(true)), TagAccess::Read); // inputs always read
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Start_Button"), "start_button");
        assert_eq!(slugify("Motor Speed"), "motor_speed");
        assert_eq!(slugify("S1_AI_1(Flash_Tank_Level)"), "s1_ai_1_flash_tank_level");
        assert_eq!(slugify("DB1_Value"), "db1_value");
    }

    #[test]
    fn test_parse_xml() {
        let xml = br#"<?xml version="1.0" encoding="utf-8"?>
<Document>
  <SW.Tags.PlcTagTable ID="0">
    <AttributeList>
      <Name>IO Signals</Name>
    </AttributeList>
    <ObjectList>
      <SW.Tags.PlcTag ID="1" CompositionName="Tags">
        <AttributeList>
          <DataTypeName>Bool</DataTypeName>
          <LogicalAddress>%I0.0</LogicalAddress>
          <Name>Start_Button</Name>
          <Comment>
            <MultiLanguageText Lang="en-US">Main start button</MultiLanguageText>
          </Comment>
        </AttributeList>
      </SW.Tags.PlcTag>
      <SW.Tags.PlcTag ID="2" CompositionName="Tags">
        <AttributeList>
          <DataTypeName>Int</DataTypeName>
          <LogicalAddress>%MW10</LogicalAddress>
          <Name>Motor_Speed</Name>
        </AttributeList>
      </SW.Tags.PlcTag>
    </ObjectList>
  </SW.Tags.PlcTagTable>
</Document>"#;

        let tags = parse_xml(xml).unwrap();
        assert_eq!(tags.len(), 2);

        assert_eq!(tags[0].name, "Start_Button");
        assert_eq!(tags[0].data_type, "Bool");
        assert_eq!(tags[0].address, "%I0.0");
        assert_eq!(tags[0].comment.as_deref(), Some("Main start button"));
        assert_eq!(tags[0].table_name.as_deref(), Some("IO Signals"));

        assert_eq!(tags[1].name, "Motor_Speed");
        assert_eq!(tags[1].data_type, "Int");
        assert_eq!(tags[1].address, "%MW10");
        assert!(tags[1].comment.is_none());
    }

    #[test]
    fn test_parse_csv_tab() {
        let csv =
            b"Name\tData type\tAddress\tComment\nStart_Button\tBool\t%I0.0\tMain start\nMotor_Speed\tInt\t%MW10\t";
        let tags = parse_csv(csv).unwrap();
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "Start_Button");
        assert_eq!(tags[0].address, "%I0.0");
        assert_eq!(tags[0].comment.as_deref(), Some("Main start"));
        assert_eq!(tags[1].name, "Motor_Speed");
        assert!(tags[1].comment.is_none());
    }

    #[test]
    fn test_parse_csv_with_path() {
        let csv = b"Name\tPath\tData Type\tLogical Address\tComment\tHmi Writeable\nS1_DI_0\tCPU_IO\tBool\t%I0.0\t\tTrue\nS1_DO_0\tCPU_IO\tBool\t%Q0.0\t\tTrue";
        let tags = parse_csv(csv).unwrap();
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].table_name.as_deref(), Some("CPU_IO"));
        assert_eq!(tags[0].hmi_writeable, Some(true));
    }

    #[test]
    fn test_parse_csv_semicolon() {
        let csv = b"Name;Data type;Address;Comment\nValve_1;Bool;%Q0.0;Output valve";
        let tags = parse_csv(csv).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "Valve_1");
        assert_eq!(tags[0].data_type, "Bool");
        assert_eq!(tags[0].address, "%Q0.0");
    }

    #[test]
    fn test_to_tag_groups() {
        let tags = vec![
            TiaTag {
                name: "Start".to_string(),
                data_type: "Bool".to_string(),
                address: "%I0.0".to_string(),
                comment: None,
                table_name: None,
                hmi_writeable: None,
            },
            TiaTag {
                name: "Valve".to_string(),
                data_type: "Bool".to_string(),
                address: "%Q0.0".to_string(),
                comment: None,
                table_name: None,
                hmi_writeable: None,
            },
            TiaTag {
                name: "Speed".to_string(),
                data_type: "Int".to_string(),
                address: "%MW0".to_string(),
                comment: Some("Speed value".to_string()),
                table_name: None,
                hmi_writeable: None,
            },
        ];

        let groups = to_tag_groups(tags);
        assert_eq!(groups.len(), 3);

        let inputs = groups.iter().find(|g| g.name == "Inputs").unwrap();
        assert_eq!(inputs.tags.len(), 1);
        assert_eq!(inputs.tags[0].address, "I0.0");
        assert_eq!(inputs.tags[0].access, TagAccess::Read);

        let outputs = groups.iter().find(|g| g.name == "Outputs").unwrap();
        assert_eq!(outputs.tags[0].access, TagAccess::ReadWrite);

        let markers = groups.iter().find(|g| g.name == "Markers").unwrap();
        assert_eq!(markers.tags[0].name, "Speed");
        assert!(matches!(markers.tags[0].data_type, DriverDataType::Int16));
    }

    #[test]
    fn test_to_tag_groups_with_table_name() {
        let tags = vec![
            TiaTag {
                name: "Tag1".to_string(),
                data_type: "Bool".to_string(),
                address: "%I0.0".to_string(),
                comment: None,
                table_name: Some("My Table".to_string()),
                hmi_writeable: None,
            },
            TiaTag {
                name: "Tag2".to_string(),
                data_type: "Bool".to_string(),
                address: "%Q0.0".to_string(),
                comment: None,
                table_name: Some("My Table".to_string()),
                hmi_writeable: None,
            },
        ];

        let groups = to_tag_groups(tags);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].name, "My Table");
        assert_eq!(groups[0].tags.len(), 2);
    }

    #[test]
    fn test_parse_tia_file_auto_detect() {
        let xml = br#"<?xml version="1.0"?>
<Document>
  <SW.Tags.PlcTagTable ID="0">
    <AttributeList><Name>Test</Name></AttributeList>
    <ObjectList>
      <SW.Tags.PlcTag ID="1" CompositionName="Tags">
        <AttributeList>
          <Name>Tag1</Name>
          <DataTypeName>Bool</DataTypeName>
          <LogicalAddress>%I0.0</LogicalAddress>
        </AttributeList>
      </SW.Tags.PlcTag>
    </ObjectList>
  </SW.Tags.PlcTagTable>
</Document>"#;

        let tags = parse_tia_file("export.xml", xml).unwrap();
        assert_eq!(tags.len(), 1);

        let csv = b"Name\tData type\tAddress\nTag1\tBool\t%I0.0";
        let tags = parse_tia_file("export.csv", csv).unwrap();
        assert_eq!(tags.len(), 1);
    }
}
