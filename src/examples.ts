export interface Example {
  id: string;
  label: string;
  kind: 'JSON' | 'OpenAPI';
  text: string;
}

const usersJson = `{
  "users": [
    {
      "id": 1,
      "name": "Ava Chen",
      "email": "ava@acme.dev",
      "role": "admin",
      "isActive": true,
      "lastLogin": "2026-05-12T09:30:00Z",
      "address": { "city": "San Jose", "zip": "95112" },
      "tags": ["beta", "pro"]
    },
    {
      "id": 2,
      "name": "Noah Patel",
      "email": "noah@acme.dev",
      "role": "member",
      "isActive": false,
      "lastLogin": null,
      "address": { "city": "Sunnyvale", "zip": "94086" },
      "tags": []
    },
    {
      "id": 3,
      "name": "Maya Kim",
      "email": "maya@acme.dev",
      "role": "member",
      "isActive": true,
      "lastLogin": "2026-06-01T17:05:00Z",
      "address": { "city": "Palo Alto", "zip": "94301" },
      "tags": ["beta"],
      "referredBy": 1
    }
  ]
}`;

const paymentsJson = `{
  "object": "list",
  "url": "https://api.example.com/v1/charges",
  "has_more": false,
  "data": [
    {
      "id": "ch_3PJq2wLkdIwGlenn0Y5C4Zb1",
      "amount": 4999,
      "currency": "usd",
      "status": "succeeded",
      "paid": true,
      "created": "2026-04-02T08:15:00Z",
      "customer": {
        "id": "cus_Q1x8mM2ah0LqPz",
        "email": "billing@vantor.io",
        "name": "Vantor Labs"
      },
      "payment_method": "card",
      "receipt_url": "https://pay.example.com/receipts/ch_3PJq2w",
      "refunded": false,
      "failure_message": null
    },
    {
      "id": "ch_3PKk9dLkdIwGlenn1r7T8Xc2",
      "amount": 12000,
      "currency": "usd",
      "status": "failed",
      "paid": false,
      "created": "2026-04-05T19:42:00Z",
      "customer": {
        "id": "cus_Q2b4nR8st1MvWx",
        "email": "ap@northline.co",
        "name": "Northline"
      },
      "payment_method": "us_bank_account",
      "refunded": false,
      "failure_message": "insufficient_funds"
    }
  ]
}`;

const todosOpenApi = `openapi: 3.0.3
info:
  title: Todos API
  version: 1.0.0
paths:
  /todos:
    get:
      operationId: listTodos
      summary: List all todos
      parameters:
        - name: status
          in: query
          required: false
          schema:
            type: string
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Todo"
    post:
      operationId: createTodo
      summary: Create a todo
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [title]
              properties:
                title:
                  type: string
                dueDate:
                  type: string
                  format: date
                priority:
                  type: integer
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Todo"
  /todos/{todoId}:
    get:
      operationId: getTodo
      summary: Fetch one todo
      parameters:
        - name: todoId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Todo"
    delete:
      operationId: deleteTodo
      summary: Delete a todo
      parameters:
        - name: todoId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "204":
          description: Deleted
components:
  schemas:
    Todo:
      type: object
      required: [id, title, status, createdAt]
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        status:
          type: string
          enum: [open, in_progress, done]
        dueDate:
          type: string
          format: date
          nullable: true
        priority:
          type: integer
        createdAt:
          type: string
          format: date-time
        assignee:
          $ref: "#/components/schemas/User"
    User:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        email:
          type: string
          format: email`;

export const EXAMPLES: Example[] = [
  { id: 'users', label: 'Users API', kind: 'JSON', text: usersJson },
  { id: 'payments', label: 'Payments list', kind: 'JSON', text: paymentsJson },
  { id: 'todos', label: 'Todos spec', kind: 'OpenAPI', text: todosOpenApi },
];
