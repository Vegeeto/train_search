# Application Agents & Services

This document describes the core logic handlers (agents) that power the FGC Real-Time Train Tracker.

## 🚆 FGC Service Agent (`src/services/fgcService.ts`)

The `fgcService` acts as the primary data agent for the application, abstracting the complexity of the FGC Open Data API and providing a clean interface for the UI.

### Key Responsibilities

1.  **Dynamic Station Discovery**:
    -   `fetchStations(routeUrl)`: Dynamically fetches all unique stations for a specific route network (e.g., Llobregat-Anoia).
    -   **Deduplication**: Automatically deduplicates stations by name to ensure a clean user interface.

2.  **Real-Time Train Fetching**:
    -   `fetchTrains(...)`: Fetches upcoming arrivals and departures for a specific station.
    -   **Terminal Logic**: Intelligently handles terminal stations (Plaça Espanya, Pl. Catalunya, Lleida Pirineus) by adjusting the `where` clause to filter out inbound trains at the start of a line.
    -   **Advanced Filtering**: Supports filtering by specific hours, train types (route short names), and route networks.

3.  **Reliability Layer**:
    -   **Fetch Timeout**: Implements a custom `fetchWithTimeout` utility to prevent requests from hanging indefinitely.
    -   **Error Handling**: Robust error catching and logging to ensure the application remains stable during network issues.

### API Interaction Model

The service interacts with the [FGC Open Data API](https://dadesobertes.fgc.cat/) using Opendatasoft's query language. It constructs complex `where` clauses to perform server-side filtering, minimizing the data transferred to the client.

## 🔄 State Synchronization Agent (`src/App.tsx`)

The main application component acts as a synchronization agent, coordinating the relationship between route networks, stations, and train data.

### Synchronization Logic

-   **Route-to-Station Sync**: When a user changes the Route Network, the app automatically triggers a station fetch and updates the selection if the current station is no longer valid for that network.
-   **Atomic Updates**: Uses an `isSyncingStations` state to prevent redundant API calls during route transitions, ensuring that train data is only fetched once the station list is fully synchronized.
-   **Auto-Refresh**: Implements a 60-second polling mechanism for live data, which is automatically disabled when a specific time filter is active.

## 🛠️ Configuration Agent (`src/types.ts`)

The `types.ts` file acts as a static configuration agent, defining the structural metadata for the application.

-   **Route Metadata**: Defines the `ROUTES` array, which includes the `terminal` name and `originId` for each network, allowing the service and UI to adapt dynamically.
-   **Type Safety**: Provides strict TypeScript interfaces for API responses and internal data models.
