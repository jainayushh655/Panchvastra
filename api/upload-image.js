import { put } from '@vercel/blob'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
      })
    }

    const file = req.files?.file

    if (!file) {
      return res.status(400).json({
        error: 'No file uploaded',
      })
    }

    const blob = await put(
      `products/${Date.now()}-${file.name}`,
      file.data,
      {
        access: 'public',
      }
    )

    return res.status(200).json({
      url: blob.url,
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      error: 'Upload failed',
    })
  }
}