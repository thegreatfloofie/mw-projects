import { MW_LOGO } from '@/lib/logo'

interface Props {
  invert?: boolean
  height?: number
}

export default function MWLogo({ invert = true, height = 22 }: Props) {
  return (
    <img
      src={MW_LOGO}
      alt="Marketwake"
      style={{ height, width: 'auto', display: 'block', filter: invert ? 'invert(1)' : 'none' }}
    />
  )
}
