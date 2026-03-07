use super::capability::CapabilityDeclaration;
use crate::mtp::{
    ActiveElement, BinDrvConfig, BinMonConfig, BinVlvConfig, DIntDrvConfig, DIntMonConfig,
    IndicatorElement, OpcUaConfig, PeaConfig, PIDCtrlConfig, ProcedureConfig, ServiceConfig,
    ServiceParameter, WriterInfo, AnaDrvConfig, AnaVlvConfig,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeaDefinition {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub writer: WriterInfo,
    pub services: Vec<ServiceConfig>,
    pub active_elements: Vec<ActiveElement>,
    pub capabilities: Vec<CapabilityDeclaration>,
    pub canonical_tags: Vec<CanonicalTag>,
    pub transport: Option<OpcUaConfig>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanonicalTag {
    pub key: String,
    pub direction: CanonicalTagDirection,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CanonicalTagDirection {
    Read,
    Write,
    ReadWrite,
}

impl From<PeaConfig> for PeaDefinition {
    fn from(value: PeaConfig) -> Self {
        let canonical_tags = canonical_tags_from_config(&value);
        Self {
            id: value.id,
            name: value.name,
            version: value.version,
            description: value.description,
            writer: value.writer,
            services: value.services,
            active_elements: value.active_elements,
            capabilities: Vec::new(),
            canonical_tags,
            transport: Some(value.opcua_config),
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

pub fn canonical_tags_from_config(config: &PeaConfig) -> Vec<CanonicalTag> {
    let mut tags = Vec::new();

    for service in &config.services {
        for parameter in &service.config_parameters {
            tags.push(CanonicalTag {
                key: format!("service.{}.config.{}", service.tag, parameter_tag(parameter)),
                direction: CanonicalTagDirection::ReadWrite,
                source: "service.config".to_string(),
            });
        }

        for procedure in &service.procedures {
            canonical_tags_from_procedure(service, procedure, &mut tags);
        }
    }

    for element in &config.active_elements {
        canonical_tags_from_active_element(element, &mut tags);
    }

    tags
}

fn canonical_tags_from_procedure(
    service: &ServiceConfig,
    procedure: &ProcedureConfig,
    tags: &mut Vec<CanonicalTag>,
) {
    for parameter in &procedure.parameters {
        tags.push(CanonicalTag {
            key: format!(
                "service.{}.procedure.{}.param.{}",
                service.tag,
                procedure.id,
                parameter_tag(parameter)
            ),
            direction: CanonicalTagDirection::ReadWrite,
            source: "procedure.parameter".to_string(),
        });
    }

    for indicator in &procedure.process_value_outs {
        tags.push(CanonicalTag {
            key: format!(
                "service.{}.procedure.{}.pvo.{}",
                service.tag,
                procedure.id,
                indicator_tag(indicator)
            ),
            direction: CanonicalTagDirection::Read,
            source: "procedure.process_value_out".to_string(),
        });
    }

    for indicator in &procedure.report_values {
        tags.push(CanonicalTag {
            key: format!(
                "service.{}.procedure.{}.report.{}",
                service.tag,
                procedure.id,
                indicator_tag(indicator)
            ),
            direction: CanonicalTagDirection::Read,
            source: "procedure.report_value".to_string(),
        });
    }
}

fn canonical_tags_from_active_element(element: &ActiveElement, tags: &mut Vec<CanonicalTag>) {
    match element {
        ActiveElement::BinVlv(v) => add_bin_vlv_tags(v, tags),
        ActiveElement::BinMon(v) => add_bin_mon_tags(v, tags),
        ActiveElement::AnaVlv(v) => add_ana_vlv_tags(v, tags),
        ActiveElement::BinDrv(v) => add_bin_drv_tags(v, tags),
        ActiveElement::AnaDrv(v) => add_ana_drv_tags(v, tags),
        ActiveElement::DIntDrv(v) => add_dint_drv_tags(v, tags),
        ActiveElement::DIntMon(v) => add_dint_mon_tags(v, tags),
        ActiveElement::PIDCtrl(v) => add_pid_ctrl_tags(v, tags),
    }
}

fn add_tag(tags: &mut Vec<CanonicalTag>, key: String, direction: CanonicalTagDirection, source: &str) {
    tags.push(CanonicalTag {
        key,
        direction,
        source: source.to_string(),
    });
}

fn add_bin_vlv_tags(v: &BinVlvConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.open_fbk", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.close_fbk", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.open_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.close_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
}

fn add_bin_mon_tags(v: &BinMonConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.fbk", v.tag), CanonicalTagDirection::Read, "active_element");
}

fn add_ana_vlv_tags(v: &AnaVlvConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.pos_fbk", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.pos_sp", v.tag), CanonicalTagDirection::Write, "active_element");
}

fn add_bin_drv_tags(v: &BinDrvConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.fwd_fbk", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.rev_fbk", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.fwd_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.rev_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.stop_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
}

fn add_ana_drv_tags(v: &AnaDrvConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.rpm_fbk", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.rpm_sp", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.fwd_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.rev_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.stop_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
}

fn add_dint_drv_tags(v: &DIntDrvConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.rpm_fbk", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.rpm_sp", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.fwd_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.rev_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
    add_tag(tags, format!("active.{}.stop_cmd", v.tag), CanonicalTagDirection::Write, "active_element");
}

fn add_dint_mon_tags(v: &DIntMonConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.fbk", v.tag), CanonicalTagDirection::Read, "active_element");
}

fn add_pid_ctrl_tags(v: &PIDCtrlConfig, tags: &mut Vec<CanonicalTag>) {
    add_tag(tags, format!("active.{}.pv", v.tag), CanonicalTagDirection::Read, "active_element");
    add_tag(tags, format!("active.{}.sp", v.tag), CanonicalTagDirection::ReadWrite, "active_element");
    add_tag(tags, format!("active.{}.mv", v.tag), CanonicalTagDirection::Write, "active_element");
}

fn parameter_tag(parameter: &ServiceParameter) -> &str {
    match parameter {
        ServiceParameter::Analog(p) => &p.tag,
        ServiceParameter::Binary(p) => &p.tag,
        ServiceParameter::DInt(p) => &p.tag,
        ServiceParameter::StringParam(p) => &p.tag,
    }
}

fn indicator_tag(indicator: &IndicatorElement) -> &str {
    match indicator {
        IndicatorElement::AnaView(v) => &v.tag,
        IndicatorElement::BinView(v) => &v.tag,
        IndicatorElement::BinStringView(v) => &v.tag,
        IndicatorElement::DIntView(v) => &v.tag,
        IndicatorElement::DIntStringView(v) => &v.tag,
        IndicatorElement::StringView(v) => &v.tag,
    }
}
