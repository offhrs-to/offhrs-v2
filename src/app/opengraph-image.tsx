import { ImageResponse } from 'next/og'

export const alt = 'offhrs — discover creative workshops'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #FAFAF8 0%, #EDF2ED 55%, #E8E6E0 100%)',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            borderRadius: 24,
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid #D9D7CF',
            maxWidth: 900,
          }}
        >
          <p style={{ margin: 0, fontSize: 28, color: '#5D755D', fontWeight: 600, letterSpacing: 6 }}>
            OFFHRS
          </p>
          <p style={{ margin: '24px 0 0', fontSize: 56, color: '#1a1a1a', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>
            Discover creative workshops
          </p>
          <p style={{ margin: '20px 0 0', fontSize: 24, color: '#555', textAlign: 'center', maxWidth: 720 }}>
            Book pottery, floral, culinary & more across Toronto.
          </p>
        </div>
      </div>
    ),
    { ...size }
  )
}
