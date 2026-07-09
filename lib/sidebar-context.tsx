"use client"

import { createContext, useContext } from "react"

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
})

export const SidebarProvider = SidebarContext.Provider
export const useSidebar = () => useContext(SidebarContext)
