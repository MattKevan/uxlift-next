'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/16/solid'
import MobileSidebar from '@/components/Sidebar'

export default function MobileMenuButton() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="lg:hidden inline-flex  items-center justify-center p-4 hover:bg-gray-100 border-r"
        onClick={() => setSidebarOpen(true)}

      >
        <span className="sr-only">Open sidebar</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="lg:hidden  relative z-50" onClose={() => setSidebarOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div 
              className="fixed inset-0 bg-gray-950/10 backdrop-blur-lg" 
              aria-hidden="true"
              onClick={() => setSidebarOpen(false)}
            />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-in-out duration-300"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in-out duration-300"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-full max-w-xs flex-1">
                <div className="flex h-full flex-col overflow-y-auto bg-white pb-4 w-64">
                  <div className="flex items-center justify-between border-b">
                    <button
                      type="button"
                      className="p-4 text-gray-700 hover:bg-gray-100 border-r"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <MobileSidebar onClose={() => setSidebarOpen(false)} />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  )
}
