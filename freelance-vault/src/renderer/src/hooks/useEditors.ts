import { useState, useEffect } from 'react'

export interface DetectedEditor {
  name: string
  appName: string
  cli: string | null
}

export function useEditors() {
  const [editors, setEditors] = useState<DetectedEditor[]>([])

  useEffect(() => {
    window.electron.editorsDetect().then(setEditors).catch(() => setEditors([]))
  }, [])

  const openInEditor = async (folderPath: string, editor: DetectedEditor) => {
    return window.electron.editorsOpen({ folderPath, appName: editor.appName, cli: editor.cli })
  }

  return { editors, openInEditor }
}
