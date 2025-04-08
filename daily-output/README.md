# NexERP Daily Output Module (Node.js Version)

This project is a Node.js refactoring of the Daily Output functionality from the NexERP PHP application.

## Project Structure

```
daily-output-refactor/
├── app.js                   # Main application file and server setup
├── package.json             # Node.js dependencies and scripts
├── public/                  # Static assets
│   ├── css/                 # CSS stylesheets
│   ├── js/                  # JavaScript files
│   └── images/              # Image assets
└── views/                   # EJS templates
    ├── daily_output.ejs     # Daily output form view 
    └── daily_inquiry.ejs    # Daily output inquiry/listing view
```

## Features Implemented

- Daily Output form for creating new output records
- Viewing existing daily output records
- Editing daily output records
- Voiding daily output records
- Daily output inquiry/listing page

## Technologies Used

- Node.js - JavaScript runtime
- Express - Web framework
- EJS - Template engine
- MySQL2 - Database connectivity
- Moment.js - Date manipulation
- Express-session - Session management

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure database connection in app.js
4. Start the server:
   ```
   npm start
   ```
   
   For development with auto-reload:
   ```
   npm run dev
   ```

## Routes

- GET /page/manufacture/daily_output - New daily output form
- GET /page/manufacture/daily_output/view/:id - View existing daily output
- GET /page/manufacture/daily_output/edit/:id - Edit existing daily output 
- GET /page/manufacture/daily_inquiry - List and search daily outputs
- POST /page/dailyc - Create new daily output
- POST /page/dailyu - Update daily output
- POST /page/dailydel - Void daily output

## Database Tables

The application interacts with the following database tables:

- tbl_daily_txn - Main daily output transactions
- tbl_daily_item - Daily output items (inputs and outputs)
- tbl_daily_item_batch - Batches for daily output items
- tbl_daily_machine - Machines used in daily output
- tbl_daily_mold - Molds used in daily output
- tbl_daily_tool - Tools used in daily output
- tbl_daily_operator - Operators involved in daily output

## Notes on Refactoring

This Node.js implementation is a refactoring of the PHP-based daily output functionality from NexERP. It maintains the same functionality while modernizing the architecture:

1. Replaced PHP procedural code with Node.js/Express
2. Converted PHP templates to EJS templates
3. Replaced PHP PDO with MySQL2/Promise for database operations
4. Implemented proper async/await patterns for database operations
5. Structured routes in a RESTful manner

The UI has been kept similar to maintain familiarity for users of the original system.

## Implementation Details

  1. app.js - Main application file with:
    - Express server setup
    - Database connection
    - Routes for daily output functions
    - Helper functions that replicate the PHP functionality
  2. views/daily_output.ejs - EJS template that mirrors the original PHP form layout with:
    - Purpose selection
    - JO and process selection
    - Time tracking fields
    - Input and output item tables
    - Proper conditional rendering based on view/edit/new modes
  3. views/daily_inquiry.ejs - Search and listing page for daily outputs
  4. package.json - Dependencies and scripts for the Node.js application
  5. README.md - Documentation explaining the structure and features

  The implementation maintains the core functionality while modernizing the codebase:
  - Replaced PHP procedural code with Node.js/Express
  - Used proper async/await for database operations
  - Structured routes in a RESTful manner
  - Maintained the same UI for user familiarity

  To run this application, you'd need to:
  1. Install dependencies with npm install
  2. Configure your database connection in app.js
  3. Start the server with npm start or npm run dev
