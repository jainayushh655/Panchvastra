const MAX_IMAGE_EDGE = 1600

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

function compressRasterDataUrl(dataUrl: string, maxEdge: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (!w || !h) {
        resolve(dataUrl)
        return
      }
      const scale = Math.min(1, maxEdge / Math.max(w, h))
      const tw = Math.round(w * scale)
      const th = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, tw, th)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Downscale large rasters to JPEG for localStorage CMS storage. */
export async function imageFileToStoredUrl(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return raw
  return compressRasterDataUrl(raw, MAX_IMAGE_EDGE)
}
