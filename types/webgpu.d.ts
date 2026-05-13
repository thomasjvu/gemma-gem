interface Navigator {
  gpu?: {
    requestAdapter(): Promise<{
      features: Set<string>
      info?: {
        vendor?: string
        architecture?: string
        device?: string
      }
      requestDevice(): Promise<{ destroy(): void }>
    } | null>
  }
}
