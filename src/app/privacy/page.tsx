import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Privacy Policy | offhrs',
  alternates: { canonical: 'https://offhrs.app/terms/privacy-policy' },
}

export default function PrivacyRedirect() {
  redirect('/terms/privacy-policy')
}
