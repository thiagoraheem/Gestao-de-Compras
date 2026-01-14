I will design and implement a specialized "Material Conference" interface that integrates with the existing system.

### 1. New Page & Route
- Create `client/src/pages/MaterialConferencePage.tsx` as the main entry point.
- Register route `/conferencia-material` in `client/src/App.tsx`.
- The page will use `useQuery` to fetch purchase requests specifically in the `recebimento` phase, using the existing endpoint `/api/purchase-requests/phase/recebimento` (or filtering client-side if needed for consistency).
- Implement real-time updates using `refetchInterval` (polling every 30s) as requested.

### 2. Dashboard Component (`ConferenceDashboard`)
- Create `client/src/components/conference/ConferenceDashboard.tsx`.
- Will calculate and display metrics based on the fetched orders:
  - **Total Pending**: Count of orders in "recebimento".
  - **Urgent**: Count of orders with "High" urgency.
  - **Late**: Count of orders past `idealDeliveryDate`.
  - **Volume**: Simple chart or progress bar showing completion status (if data available).

### 3. Order List & Cards (`ConferenceOrderList`, `ConferenceOrderCard`)
- Create `client/src/components/conference/ConferenceOrderList.tsx` to handle filtering and layout.
  - **Filters**: Search by number, filter by Supplier, Priority.
  - **Layout**: Responsive grid/list view.
- Create `client/src/components/conference/ConferenceOrderCard.tsx` for individual items.
  - **Visuals**: Clean card design with color-coded status/urgency borders.
  - **Info**: Order #, Supplier, Date, Items summary.
  - **Actions**: "Conferir" button to start the process.

### 4. Integration with Existing Flow
- When a user clicks "Conferir" on a card, it will open the existing `ReceiptPhase` component in a modal/dialog.
- I will reuse `ReceiptPhase` with the `hideTabsByDefault` prop to focus on the physical receipt task, ensuring consistency with the current logic.
- The "Fiscal Confirmation" transition is already handled by the `ReceiptPhase` logic upon completion.

### 5. Navigation
- Add a "Conferência" button in the main `ListPage` or header to provide easy access to this new specialized view.

### Verification
- I will verify the implementation by navigating to `/conferencia-material` and checking if orders appear, filters work, and the "Conferir" action successfully opens the receipt interface.
