I have analyzed the codebase and designed a plan to restructure the material receipt flow as requested.

### 1. Database Schema Changes
*   **Table**: `purchase_requests`
*   **New Columns**:
    *   `physical_receipt_at` (Timestamp): To track when physical receipt was confirmed.
    *   `physical_receipt_by_id` (Integer): ID of the user who confirmed physical receipt.
    *   `fiscal_receipt_at` (Timestamp): To track when fiscal confirmation was done.
    *   `fiscal_receipt_by_id` (Integer): ID of the user who confirmed fiscal data.

### 2. Backend Implementation
*   **New Endpoints**:
    *   `POST /api/purchase-requests/:id/confirm-physical`: Saves received quantities and marks physical receipt as done.
    *   `POST /api/purchase-requests/:id/confirm-fiscal`: Saves invoice/fiscal data and marks fiscal receipt as done.
*   **Logic Update**:
    *   Both endpoints will check if the *other* step is already completed.
    *   **Only** when both steps are complete will the system:
        1.  Trigger the ERP integration (`/api/integracao-locador/recebimento`).
        2.  Move the request phase to `conclusao_compra`.

### 3. Frontend Implementation
*   **Component**: `PurchaseCard.tsx`
    *   **Card Click**: Will open the modal in **"View"** mode (Read-only "Informações Básicas").
    *   **"Confirmar" Button**: Will open the modal in **"Physical"** mode (Focus on "Confirmação de Itens").
    *   **New "Conf. Fiscal" Button**: Will be added (Orange color). Opens modal in **"Fiscal"** mode (Focus on "Informações de Nota Fiscal").
    *   Buttons will be disabled/enabled based on the completion status of each step.

*   **Component**: `ReceiptPhase.tsx`
    *   Refactor to accept a `mode` prop (`view` | `physical` | `fiscal`).
    *   **View Mode**: Displays only "Informações Básicas" (read-only).
    *   **Physical Mode**: Displays "Confirmação de Itens", allows editing quantities, and has "Confirmar Recebimento Físico" button.
    *   **Fiscal Mode**: Displays fiscal tabs ("Nota Fiscal", "Manual", "Financeiro"), allows editing, and has "Confirmar Fiscal" button.
    *   Implement "Save Progress" logic by persisting data to the `receipts` table via the new endpoints.

### 4. Kanban & Validation
*   The Kanban card will automatically move to "Conclusão" only after both Physical and Fiscal steps are confirmed.
*   Validations will be added to ensure a step cannot be "un-done" easily or that data is consistent.
