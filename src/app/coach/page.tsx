import { Suspense } from 'react'
import CoachClient from './CoachClient'

export default function CoachPage() {
  return (
    <Suspense>
      <CoachClient />
    </Suspense>
  )
}
