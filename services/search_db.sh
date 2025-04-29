#!/bin/bash

DB_HOST=localhost
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=nex_valiant
SEARCH_TERM='CA21-004'  # Removed the tab character

echo "Searching for '$SEARCH_TERM' in database $DB_NAME..."

# Test connection first
if ! mysql -u$DB_USER -p$DB_PASSWORD -h$DB_HOST -e "USE $DB_NAME;" 2>/dev/null; then
  echo "Error: Cannot connect to database. Check credentials and permissions."
  exit 1
fi

# Get all tables
tables=$(mysql -u$DB_USER -p$DB_PASSWORD -h$DB_HOST -e "SHOW TABLES;" $DB_NAME 2>/dev/null | grep -v "Tables_in")

if [ -z "$tables" ]; then
  echo "Error: Could not retrieve tables or no tables exist. Check permissions."
  exit 1
fi

# Search each table for the term
for table in $tables; do
  echo "Checking table: $table"
  
  # Try to get columns safely
  columns=$(mysql -u$DB_USER -p$DB_PASSWORD -h$DB_HOST -e "SHOW COLUMNS FROM $table;" $DB_NAME 2>/dev/null | awk '{print $1}' | grep -v "^Field$")
  
  if [ -z "$columns" ]; then
    echo "  Warning: Could not retrieve columns for table $table. Skipping."
    continue
  fi
  
  # Search each column
  for column in $columns; do
    # Get column type safely
    col_type=$(mysql -u$DB_USER -p$DB_PASSWORD -h$DB_HOST -e "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='$table' AND COLUMN_NAME='$column';" 2>/dev/null | grep -v "DATA_TYPE")
    
    if [[ "$col_type" =~ ^(varchar|char|text|longtext|mediumtext|enum)$ ]]; then
      result=$(mysql -u$DB_USER -p$DB_PASSWORD -h$DB_HOST -e "SELECT COUNT(*) FROM $table WHERE $column LIKE '%$SEARCH_TERM%';" $DB_NAME 2>/dev/null | grep -v "COUNT")
      
      # Check if result is a number and greater than zero
      if [[ "$result" =~ ^[0-9]+$ ]] && [ "$result" -gt 0 ]; then
        echo "  FOUND in $table.$column: $result matches"
        mysql -u$DB_USER -p$DB_PASSWORD -h$DB_HOST -e "SELECT * FROM $table WHERE $column LIKE '%$SEARCH_TERM%' LIMIT 5;" $DB_NAME
      fi
    fi
  done
done

echo "Search complete."