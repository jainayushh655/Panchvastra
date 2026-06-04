const MAX_IMAGE_EDGE = 1600

function compressImage(
  file: File,
  maxEdge: number
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      let width = img.naturalWidth
      let height = img.naturalHeight

      const scale = Math.min(
        1,
        maxEdge / Math.max(width, height)
      )

      width = Math.round(width * scale)
      height = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          resolve(blob || file)
        },
        'image/jpeg',
        0.88
      )
    }

    img.onerror = () => resolve(file)

    img.src = URL.createObjectURL(file)
  })
}

/**
 * Upload image to Vercel Blob and return public URL
 */
export async function imageFileToStoredUrl(
  file: File
): Promise<string> {
  let uploadFile: Blob = file

  if (
    file.type !== 'image/svg+xml' &&
    file.type !== 'image/gif'
  ) {
    uploadFile = await compressImage(
      file,
      MAX_IMAGE_EDGE
    )
  }

  const formData = new FormData()
  formData.append('file', uploadFile, file.name)

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Image upload failed')
  }

  const data = await response.json()

  return data.url
}