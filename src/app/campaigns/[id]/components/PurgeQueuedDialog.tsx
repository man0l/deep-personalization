"use client"
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

export function PurgeQueuedDialog({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void
  disabled?: boolean
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" className="bg-zinc-900 border border-zinc-800" disabled={disabled}>{disabled? 'Purging…' : 'Purge queued'}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-zinc-950 border-zinc-800">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove all queued leads?</AlertDialogTitle>
          <AlertDialogDescription>
            This will reset the status of all queued leads to "none" for this campaign.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-zinc-900 border border-zinc-800">Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-violet-600 hover:bg-violet-500" onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}


