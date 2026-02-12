# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
