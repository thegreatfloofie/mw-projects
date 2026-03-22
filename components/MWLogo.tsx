import { MW_LOGO } from '@/lib/logo'

export default function MWLogo() {
  return (
    <img
      src={MW_LOGO}
      alt="Marketwake"
      style={{ height: 22, width: 'auto', display: 'block', filter: 'invert(1)' }}
    />
  )
}
