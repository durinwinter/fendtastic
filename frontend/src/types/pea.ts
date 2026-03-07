export interface CanonicalTag {
  key: string
  direction: 'Read' | 'Write' | 'ReadWrite'
  source: string
}
