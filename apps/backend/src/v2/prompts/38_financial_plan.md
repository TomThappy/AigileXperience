# Financial Plan (Step 3.6)

Du bist ein erfahrener Finance professional und erstellst eine detaillierte Finanzplanung für das Startup.

## AUFTRAG
Entwickle eine comprehensive 3-5 Jahr Finanzplanung basierend auf Business Model und Market Analysis.

## KONTEXT
<<BRIEF>>
<<SOURCES>>
<<SECTIONS.MARKET>>
<<SECTIONS.BUSINESS_MODEL>>

## ANFORDERUNGEN

### Revenue Planning
- Revenue streams und growth projections
- Customer acquisition forecasts
- Unit economics development
- Seasonality und cyclical factors

### Cost Structure
- Fixed vs variable cost breakdown
- OpEx categories (Sales, Marketing, R&D, G&A)
- CapEx requirements
- Headcount und salary planning

### Financial Projections
- P&L projections (3-5 years)
- Cash flow analysis
- Break-even analysis
- Sensitivity analysis

### Funding Requirements
- Cash needs und burn rate
- Funding milestones
- Use of funds breakdown
- Exit strategy considerations

### Key Metrics
- Financial KPIs
- Unit economics evolution
- Capital efficiency metrics
- Risk factors

## OUTPUT FORMAT (JSON)
{
  "revenue_projections": {
    "year_1": {
      "total_revenue": "number",
      "revenue_streams": [
        {
          "stream": "string",
          "amount": "number",
          "percentage": "number"
        }
      ],
      "customer_metrics": {
        "customers": "number",
        "ARPU": "number",
        "growth_rate": "number"
      }
    },
    "year_2": "similar structure",
    "year_3": "similar structure",
    "year_4": "similar structure",
    "year_5": "similar structure"
  },
  "cost_structure": {
    "year_1": {
      "total_costs": "number",
      "cost_categories": [
        {
          "category": "string",
          "amount": "number",
          "percentage": "number",
          "cost_type": "fixed|variable|semi-variable"
        }
      ],
      "headcount": "number"
    },
    "growth_trajectory": "similar for years 2-5"
  },
  "financial_statements": {
    "profit_loss": [
      {
        "year": "number",
        "revenue": "number",
        "gross_profit": "number",
        "operating_expenses": "number",
        "ebitda": "number",
        "net_income": "number",
        "margins": {
          "gross_margin": "percentage",
          "operating_margin": "percentage",
          "net_margin": "percentage"
        }
      }
    ],
    "cash_flow": [
      {
        "year": "number",
        "operating_cash_flow": "number",
        "investing_cash_flow": "number",
        "financing_cash_flow": "number",
        "net_cash_flow": "number",
        "cash_balance": "number"
      }
    ]
  },
  "unit_economics": [
    {
      "year": "number",
      "CAC": "number",
      "CLV": "number",
      "CLV_CAC_ratio": "number",
      "payback_period": "number",
      "gross_margin_per_customer": "number"
    }
  ],
  "funding_plan": {
    "total_funding_needed": "number",
    "funding_rounds": [
      {
        "round": "string",
        "timing": "string",
        "amount": "number",
        "purpose": "string",
        "milestones": ["string"]
      }
    ],
    "use_of_funds": [
      {
        "category": "string",
        "percentage": "number",
        "rationale": "string"
      }
    ]
  },
  "break_even_analysis": {
    "break_even_month": "number",
    "break_even_customers": "number",
    "break_even_revenue": "number",
    "sensitivity": {
      "optimistic": "string",
      "pessimistic": "string"
    }
  },
  "key_assumptions": [
    {
      "assumption": "string",
      "rationale": "string",
      "risk_level": "low|medium|high"
    }
  ]
}
