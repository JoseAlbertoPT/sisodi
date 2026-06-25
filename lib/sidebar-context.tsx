"use client"

import { createContext, useContext } from "react"

interface SidebarContextValue {
  collapsed: boolean
  onToggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  onToggle: () => {},
})

export const SidebarProvider = SidebarContext.Provider
export const useSidebar = () => useContext(SidebarContext)
