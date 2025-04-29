# NexERP

## Project Overview
NexERP is a modular Enterprise Resource Planning system built with Node.js and Express. It provides a comprehensive solution for managing business operations across various departments including sales, purchasing, manufacturing, engineering, warehousing, and administration.

## System Architecture

### Technology Stack
- **Backend**: Node.js with Express.js framework
- **Frontend**: EJS templates with Bootstrap 5
- **Database**: MySQL (via mysql2)
- **Authentication**: JWT and session-based authentication
- **Containerization**: Docker support

### Directory Structure
```
services/
├── app.js                  # Main application entry point
├── package.json            # Node.js dependencies
├── .env                    # Environment configuration
├── .gitignore              # Git ignore rules
│
├── config/                 # Configuration files
│   ├── database.js         # Database connection
│   ├── auth.js             # Authentication configuration
│   └── ...
│
├── shared/                 # Shared components and utilities
│   ├── components/         # Reusable UI components
│   ├── middleware/         # Shared middleware
│   └── utils/              # Helper functions
│
├── m_administration/       # Administration module
│   ├── user_management/    # User management submodule
│   ├── role_management/    # Role and permissions
│   └── ...
│
├── m_engineering/          # Engineering module
│   ├── product_design/     # Product design submodule
│   └── ...
│
├── m_manufacturing/        # Manufacturing module
│   ├── production_orders/  # Production orders
│   ├── daily_output/       # Daily output tracking
│   └── ...
│
├── m_purchasing/           # Purchasing module
│   ├── purchase_orders/    # Purchase orders submodule
│   ├── vendors/            # Vendor management
│   └── ...
│
├── m_sales/                # Sales module
│   ├── sales_order/        # Sales order submodule
│   ├── customer_setup/     # Customer management
│   │   ├── models/         # Database models
│   │   ├── controllers/    # Business logic
│   │   ├── routes/         # API routes
│   │   └── views/          # EJS templates
│   └── ...
│
├── m_warehouse/            # Warehouse module
│   ├── inventory/          # Inventory management
│   ├── stock_movement/     # Stock movement tracking
│   └── ...
│
└── docker-compose/         # Docker configuration
```

## Module Structure Pattern
Each module follows an MVC architecture pattern:
- **models/**: Database interaction and business logic
- **controllers/**: Request handling and response formatting
- **routes/**: API endpoints and route definitions
- **views/**: EJS templates for rendering web pages

## Installation and Setup

### Prerequisites
- Node.js 14.x or higher
- MySQL 8.0 or higher
- npm or yarn package manager

### Getting Started
1. Clone the repository
```bash
git clone https://github.com/yourusername/nexerp.git
cd nexerp/services
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your database credentials and other settings
```

4. Start the application
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Docker Setup
```bash
cd docker-compose
docker-compose up -d
```

## Module Descriptions

### Sales Module
Manages customer relationships, orders, and pricing. Includes:
- Sales order processing
- Customer management
- Price list management
- Quotations and invoices

### Purchasing Module
Handles vendor relationships and procurement. Includes:
- Purchase order management
- Vendor management
- Material requisitions
- Receiving and inspection

### Manufacturing Module
Controls production processes and scheduling. Includes:
- Production orders
- Work center management
- Daily output tracking
- Production scheduling

### Warehouse Module
Tracks inventory and stock movements. Includes:
- Inventory management
- Stock movement tracking
- Warehouse transfers
- Stock taking

### Engineering Module
Manages product design and technical specifications. Includes:
- BOM (Bill of Materials) management
- Product design
- Engineering change requests

### Administration Module
Controls system configuration and user access. Includes:
- User management
- Role-based access control
- System configuration
- Audit logs

## API Structure
The application provides REST APIs for each module:
- API endpoints follow the pattern: `/api/{module}/{resource}`
- Web pages follow the pattern: `/page/{module}/{resource}`

## Development Workflow
1. Create models for database interaction
2. Build controllers to implement business logic
3. Define routes to expose API endpoints
4. Create views for web interface

