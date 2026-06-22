# Anexa B — Diagrame UML și model de date

Documentație standard de proiectare pentru planIT Meals. Diagramele pot fi exportate din Mermaid (VS Code, GitHub) sau redraw în StarUML / draw.io.

---

## B.1 Diagramă cazuri de utilizare (UML)

```mermaid
flowchart LR
  subgraph actors
    Guest((Utilizator\nneautentificat))
    User((Utilizator\nautentificat))
  end

  subgraph system[planIT Meals]
    UC1([Înregistrare])
    UC2([Autentificare])
    UC3([Gestionează profil])
    UC4([Gestionează rețete])
    UC5([Generează plan alimentar])
    UC6([Listă cumpărături])
    UC7([Gestionează frigider])
    UC8([Sugestii rețete])
    UC9([Tracking mese])
    UC10([Schimbă limba UI])
  end

  Guest --> UC1
  Guest --> UC2
  User --> UC3
  User --> UC4
  User --> UC5
  User --> UC6
  User --> UC7
  User --> UC8
  User --> UC9
  User --> UC10
  UC1 -.->|include| UC2
  UC5 -.->|include| UC3
  UC6 -.->|extend| UC5
  UC8 -.->|include| UC7
```

**Relații:**
- `«include»` Autentificare: toate UC3–UC9 necesită sesiune JWT.
- `«extend»` Listă cumpărături: disponibilă după generare/vizualizare plan.

---

## B.2 Diagramă de clase

```mermaid
classDiagram
  class User {
    +ObjectId _id
    +String name
    +String email
    +String passwordHash
    +UserPreferences preferences
    +matchPassword()
  }

  class UserPreferences {
    +String[] dietaryRestrictions
    +String[] allergies
    +Number dailyCalorieGoal
  }

  class Recipe {
    +ObjectId _id
    +String title
    +String instructions
    +RecipeIngredient[] ingredients
    +Number prepTime
    +Number cookTime
    +Number servings
    +Number calories
    +String category
    +String area
    +String source
    +String externalId
  }

  class RecipeIngredient {
    +String name
    +Number quantity
    +String unit
  }

  class MealPlan {
    +ObjectId _id
    +ObjectId user
    +Date startDate
    +Date endDate
    +MealPlanDay[] days
  }

  class MealPlanDay {
    +Date date
    +Meal[] meals
  }

  class Meal {
    +String type
    +ObjectId recipe
    +String notes
  }

  class FridgeItem {
    +ObjectId _id
    +ObjectId user
    +String name
    +Number quantity
    +String unit
    +String category
    +Date expiresAt
  }

  class MealLog {
    +ObjectId _id
    +ObjectId user
    +Date date
    +String mealType
    +ObjectId recipe
    +Number calories
    +Number protein
    +Number fat
    +Number carbs
  }

  class AiPlanner {
    +generatePlanDays()
    +isRecipeAllowed()
    +buildRestrictionFilters()
  }

  User "1" --> "*" MealPlan : creează
  User "1" --> "*" FridgeItem : deține
  User "1" --> "*" MealLog : înregistrează
  User "1" --> "*" Recipe : creează
  User *-- UserPreferences
  MealPlan "1" *-- "*" MealPlanDay
  MealPlanDay "1" *-- "*" Meal
  Meal --> Recipe : referă
  Recipe *-- "*" RecipeIngredient
  AiPlanner ..> Recipe : evaluează
  AiPlanner ..> User : citește preferences
  AiPlanner ..> FridgeItem : citește
```

---

## B.3 Diagramă entitate–relație (bază de date)

```mermaid
erDiagram
  USER ||--o{ MEAL_PLAN : owns
  USER ||--o{ FRIDGE_ITEM : owns
  USER ||--o{ MEAL_LOG : owns
  USER ||--o{ RECIPE : creates
  MEAL_PLAN ||--|{ MEAL_PLAN_DAY : contains
  MEAL_PLAN_DAY ||--|{ MEAL : contains
  MEAL }o--|| RECIPE : references
  RECIPE ||--|{ RECIPE_INGREDIENT : has

  USER {
    ObjectId _id PK
    string email UK
    string name
    string password
    object preferences
  }

  RECIPE {
    ObjectId _id PK
    string title
    string source
    string externalId UK
    int calories
    int servings
  }

  MEAL_PLAN {
    ObjectId _id PK
    ObjectId user FK
    date startDate
    date endDate
  }

  FRIDGE_ITEM {
    ObjectId _id PK
    ObjectId user FK
    string name
    float quantity
    string unit
  }

  MEAL_LOG {
    ObjectId _id PK
    ObjectId user FK
    date date
    string mealType
    int calories
  }
```

---

## B.4 Diagramă de secvență — generare plan alimentar

```mermaid
sequenceDiagram
  actor U as Utilizator
  participant FE as Frontend
  participant API as MealPlanController
  participant P as aiPlanner
  participant DB as MongoDB

  U->>FE: Click Generate (dată, zile)
  FE->>API: POST /api/meal-plans/generate + JWT
  API->>DB: find Recipes (calories>0)
  API->>DB: find MealLogs (14 zile)
  API->>DB: find FridgeItems
  API->>P: generatePlanDays(user, recipes, ...)
  P->>P: filter + score + best-of-N
  P-->>API: days[]
  API->>DB: create MealPlan
  API->>DB: populate recipes
  API-->>FE: 201 + plan JSON
  FE-->>U: Afișează plan
```

---

## B.5 Diagramă de componente (arhitectură)

```mermaid
flowchart TB
  subgraph Presentation
    Pages[Pages React]
    Redux[Redux Store]
    I18n[i18next]
  end

  subgraph Application
    Routes[Express Routes]
    Ctrl[Controllers]
    MW[Auth Middleware]
    Svc[aiPlanner Service]
    Utils[Shopping Utils]
  end

  subgraph Data
    Mongo[(MongoDB)]
    MealDB[TheMealDB API]
  end

  Pages --> Redux
  Redux -->|HTTP /api| Routes
  Routes --> MW --> Ctrl
  Ctrl --> Svc
  Ctrl --> Utils
  Ctrl --> Mongo
  MealDB -.->|seed script| Mongo
```

---

## B.6 Diagramă de activitate — algoritm planificare (simplificat)

```mermaid
flowchart TD
  A[Start generatePlanDays] --> B[Filtrează rețete după dietă/alergii]
  B --> C{Pool suficient?}
  C -->|Nu| D[Eroare 400]
  C -->|Da| E[Loop 4 încercări]
  E --> F[Pentru fiecare zi]
  F --> G[Alege mic dejun, cină, prânz]
  G --> H[Scoring + weighted random]
  H --> I[Calculează shopping size]
  I --> J{Mai bun decât best?}
  J -->|Da| K[Salvează best]
  J -->|Nu| E
  K --> L[Returnează plan optim]
```
