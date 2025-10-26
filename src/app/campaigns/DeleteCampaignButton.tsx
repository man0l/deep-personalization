"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DeleteCampaignButton({ id, name }: { id: string, name?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onConfirm() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
        return
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
          <AlertDialogDescription>
            {name ? `“${name}”` : 'This campaign'} and all related leads will be permanently deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-500" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


