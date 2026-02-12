# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Material Conference / Receipt**: Added "Data de Criação" field to the purchase request summary card in Receipt and Fiscal Conference phases.
- **Request Details**: Added "Data de Criação" field to the detailed request view.
- **Shared**: Updated `PurchaseRequestHeaderCard` to support `creationDate` prop and extended grid layout.

## [2026-02-11]

### Added
- **Material Conference**: Added "Purchase Order Number" and "Order Value" to the request cards and list view.
- **Material Conference**: Implemented sorting by "Purchase Order Number" and "Order Value" in the list view.
- **Material Conference**: Added tooltip "Pedido pendente" for requests without a generated purchase order number.
- **Backend**: Updated `getPurchaseRequestsByPhase` to include `purchaseOrder` details for each request.
- **Shared**: Added `PurchaseRequestWithDetails` type to support extended purchase request data.

### Changed
- **Material Conference**: Enhanced `ConferenceOrderCard` to display order number and formatted value.
- **Material Conference**: Enhanced `ConferenceOrderList` with new columns and sorting logic.
