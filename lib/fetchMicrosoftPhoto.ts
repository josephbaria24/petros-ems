// lib/fetchMicrosoftPhoto.ts
export async function fetchMicrosoftPhoto(accessToken: string): Promise<string | null> {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  
    if (!response.ok) {
      console.warn("Microsoft photo fetch failed:", response.status)
      return null
    }
  
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }
  