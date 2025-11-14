import React from 'react'
import { createRoot } from 'react-dom/client'
import RFQCreation from '../client/src/components/rfq-creation'

// JSDOM helpers
function render(component) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)
  return { container, root }
}

describe('RFQCreation Dialog', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (url, opts) => {
      if (url === '/api/quotations') {
        return { ok: true, json: async () => ({ id: 123 }) }
      }
      if (String(url).includes('/items')) {
        return { ok: true, json: async () => ({}) }
      }
      if (String(url).includes('/supplier-quotations')) {
        return { ok: true, json: async () => ({}) }
      }
      if (String(url).includes('/send-rfq')) {
        return { ok: true, json: async () => ({ emailResult: { errors: [] } }) }
      }
      return { ok: true, json: async () => ({}) }
    })
  })

  test('opens and closes via onOpenChange', () => {
    const onOpenChange = jest.fn()
    const { container } = render(
      <RFQCreation
        purchaseRequest={{ id: 1, requestNumber: 'SOL-1', createdAt: new Date().toISOString() }}
        existingQuotation={null}
        isOpen={true}
        onOpenChange={onOpenChange}
        onComplete={() => {}}
      />
    )
    const closeBtn = container.querySelector('button[aria-label="Fechar"]')
    expect(closeBtn).toBeTruthy()
    closeBtn.click()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('Cancel button closes dialog', () => {
    const onOpenChange = jest.fn()
    const { container } = render(
      <RFQCreation
        purchaseRequest={{ id: 1, requestNumber: 'SOL-1', createdAt: new Date().toISOString() }}
        existingQuotation={null}
        isOpen={true}
        onOpenChange={onOpenChange}
        onComplete={() => {}}
      />
    )
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Cancelar'))
    expect(cancelBtn).toBeTruthy()
    cancelBtn.click()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('ESC key closes dialog', () => {
    const onOpenChange = jest.fn()
    render(
      <RFQCreation
        purchaseRequest={{ id: 1, requestNumber: 'SOL-1', createdAt: new Date().toISOString() }}
        existingQuotation={null}
        isOpen={true}
        onOpenChange={onOpenChange}
        onComplete={() => {}}
      />
    )
    const evt = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(evt)
    expect(onOpenChange).toHaveBeenCalled()
  })
})

