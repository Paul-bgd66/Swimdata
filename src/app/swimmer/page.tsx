import { Suspense } from 'react'
import SwimmerClient from './SwimmerClient'

export default function SwimmerPage() {
  return (
    <Suspense>
      <SwimmerClient />
    </Suspense>
  )
}
