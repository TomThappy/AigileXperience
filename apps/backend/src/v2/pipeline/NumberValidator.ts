export interface ValidationIssue {
  severity: "critical" | "warning" | "info";
  section: string;
  field: string;
  issue: string;
  expected: number | string;
  actual: number | string;
  formula?: string;
  suggestion?: string;
}

export interface ValidationFix {
  path: string;
  current_value: number | string;
  new_value: number | string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface ValidationResult {
  validation_passed: boolean;
  issues: ValidationIssue[];
  fixes: ValidationFix[];
  warnings: string[];
  summary: {
    critical_count: number;
    warning_count: number;
    info_count: number;
    auto_fixable: number;
  };
}

export class NumberValidator {
  
  validateSections(sections: Record<string, any>): ValidationResult {
    const issues: ValidationIssue[] = [];
    const fixes: ValidationFix[] = [];
    const warnings: string[] = [];

    // 1. Business Model Validation
    if (sections.business_model?.data) {
      this.validateBusinessModel(sections.business_model.data, issues, fixes);
    }

    // 2. Market Size Consistency 
    if (sections.market?.data) {
      this.validateMarketSizing(sections.market.data, issues, fixes);
    }

    // 3. GTM Budget vs Revenue Consistency
    if (sections.gtm?.data && sections.business_model?.data) {
      this.validateGTMConsistency(sections.gtm.data, sections.business_model.data, issues, fixes);
    }

    // 4. Financial Plan Consistency
    if (sections.financial_plan?.data && sections.business_model?.data) {
      this.validateFinancialConsistency(sections.financial_plan.data, sections.business_model.data, issues, fixes);
    }

    // 5. Cross-Section Plausibility
    this.validateCrossSectionPlausibility(sections, issues, warnings);

    const summary = {
      critical_count: issues.filter(i => i.severity === "critical").length,
      warning_count: issues.filter(i => i.severity === "warning").length,
      info_count: issues.filter(i => i.severity === "info").length,
      auto_fixable: fixes.filter(f => f.confidence === "high").length
    };

    return {
      validation_passed: summary.critical_count === 0 && summary.warning_count === 0,
      issues,
      fixes,
      warnings,
      summary
    };
  }

  private validateBusinessModel(bizData: any, issues: ValidationIssue[], fixes: ValidationFix[]): void {
    const { arpu, gross_margin, churn_monthly, CAC, CLV, payback_months, contribution_per_month } = bizData;

    // CLV Formula: ARPU × Gross Margin × (1/churn_monthly)
    if (arpu && gross_margin && churn_monthly) {
      const expectedCLV = arpu * gross_margin * (1 / churn_monthly);
      
      if (CLV && Math.abs(CLV - expectedCLV) > expectedCLV * 0.05) { // 5% tolerance
        issues.push({
          severity: "critical",
          section: "business_model", 
          field: "CLV",
          issue: "CLV calculation doesn't match formula",
          expected: Math.round(expectedCLV * 100) / 100,
          actual: CLV,
          formula: "CLV = ARPU × Gross Margin × (1/churn_monthly)",
          suggestion: `Recalculate CLV using the standard formula`
        });

        fixes.push({
          path: "sections.business_model.data.CLV",
          current_value: CLV,
          new_value: Math.round(expectedCLV * 100) / 100,
          reason: "Auto-fix CLV calculation using correct formula",
          confidence: "high"
        });
      }
    }

    // Contribution per Month: ARPU × Gross Margin
    if (arpu && gross_margin) {
      const expectedContribution = arpu * gross_margin;
      
      if (contribution_per_month && Math.abs(contribution_per_month - expectedContribution) > expectedContribution * 0.05) {
        issues.push({
          severity: "warning",
          section: "business_model",
          field: "contribution_per_month", 
          issue: "Contribution per month inconsistent with ARPU × Gross Margin",
          expected: Math.round(expectedContribution * 100) / 100,
          actual: contribution_per_month,
          formula: "Contribution = ARPU × Gross Margin"
        });

        fixes.push({
          path: "sections.business_model.data.contribution_per_month",
          current_value: contribution_per_month,
          new_value: Math.round(expectedContribution * 100) / 100,
          reason: "Correct contribution calculation",
          confidence: "high"
        });
      }
    }

    // Payback Period: CAC / Contribution per Month
    if (CAC && contribution_per_month) {
      const expectedPayback = CAC / contribution_per_month;
      
      if (payback_months && Math.abs(payback_months - expectedPayback) > Math.max(expectedPayback * 0.1, 1)) {
        issues.push({
          severity: "warning",
          section: "business_model",
          field: "payback_months",
          issue: "Payback period doesn't match CAC/Contribution calculation", 
          expected: Math.round(expectedPayback * 10) / 10,
          actual: payback_months,
          formula: "Payback = CAC / Contribution per Month"
        });

        fixes.push({
          path: "sections.business_model.data.payback_months",
          current_value: payback_months,
          new_value: Math.round(expectedPayback * 10) / 10,
          reason: "Correct payback period calculation",
          confidence: "high"
        });
      }
    }

    // Plausibility Checks
    if (payback_months && payback_months > 24) {
      issues.push({
        severity: "warning",
        section: "business_model",
        field: "payback_months",
        issue: "Payback period > 24 months may be too long for Pre-Seed/Seed stage",
        expected: "< 18 months",
        actual: payback_months,
        suggestion: "Consider optimizing CAC or improving unit economics"
      });
    }

    if (CLV && CAC && (CLV / CAC) < 3) {
      issues.push({
        severity: "critical",
        section: "business_model", 
        field: "CLV_CAC_ratio",
        issue: "CLV:CAC ratio below 3:1 threshold",
        expected: "> 3.0",
        actual: Math.round((CLV / CAC) * 10) / 10,
        suggestion: "Improve unit economics - increase CLV or reduce CAC"
      });
    }

    if (gross_margin && gross_margin < 0.6) {
      issues.push({
        severity: "info",
        section: "business_model",
        field: "gross_margin",
        issue: "Gross margin below 60% - may indicate scaling challenges",
        expected: "> 0.6",
        actual: gross_margin
      });
    }
  }

  private validateMarketSizing(marketData: any, issues: ValidationIssue[], fixes: ValidationFix[]): void {
    const { tam_eur, sam_eur, som_eur } = marketData;
    
    // TAM > SAM > SOM logic check
    if (tam_eur && sam_eur && som_eur) {
      const tamValue = Array.isArray(tam_eur) ? tam_eur[0] : tam_eur;
      const samValue = Array.isArray(sam_eur) ? sam_eur[0] : sam_eur; 
      const somValue = Array.isArray(som_eur) ? som_eur[0] : som_eur;

      if (samValue > tamValue) {
        issues.push({
          severity: "critical",
          section: "market",
          field: "sam_eur",
          issue: "SAM cannot be larger than TAM",
          expected: `< ${tamValue}`,
          actual: samValue
        });
      }

      if (somValue > samValue) {
        issues.push({
          severity: "critical", 
          section: "market",
          field: "som_eur",
          issue: "SOM cannot be larger than SAM",
          expected: `< ${samValue}`,
          actual: somValue
        });
      }

      // SOM should typically be 1-10% of SAM for early stage
      if (somValue > samValue * 0.1) {
        issues.push({
          severity: "warning",
          section: "market", 
          field: "som_eur",
          issue: "SOM > 10% of SAM may be overly optimistic for early stage",
          expected: `< ${Math.round(samValue * 0.1)}`,
          actual: somValue
        });
      }
    }
  }

  private validateGTMConsistency(gtmData: any, bizData: any, issues: ValidationIssue[], fixes: ValidationFix[]): void {
    const { channels, kpis } = gtmData;
    const { arpu } = bizData;

    if (channels && kpis && arpu) {
      // Calculate total GTM budget
      const totalBudget = channels.reduce((sum: number, channel: any) => {
        return sum + (channel.budget_eur_month || 0);
      }, 0);

      // Estimate customers from budget and CAC
      if (kpis.CAC && totalBudget > 0) {
        const estimatedNewCustomers = totalBudget / kpis.CAC;
        const estimatedMRR = estimatedNewCustomers * arpu;

        // Check if subscriber targets are realistic
        if (kpis.Subscribers && kpis.Subscribers > estimatedNewCustomers * 2) {
          issues.push({
            severity: "warning",
            section: "gtm",
            field: "subscribers_target", 
            issue: "Subscriber target may be unrealistic given GTM budget and CAC",
            expected: `~${Math.round(estimatedNewCustomers)}`,
            actual: kpis.Subscribers,
            suggestion: "Increase GTM budget or optimize CAC to reach target"
          });
        }
      }
    }
  }

  private validateFinancialConsistency(financialData: any, bizData: any, issues: ValidationIssue[], fixes: ValidationFix[]): void {
    const { forecast, break_even_month } = financialData;
    const { arpu, gross_margin } = bizData;

    if (forecast && break_even_month) {
      // Find break-even point in forecast
      let foundBreakEven = false;
      
      for (const [period, data] of Object.entries(forecast)) {
        const periodData = data as any;
        if (periodData.ebitda && periodData.ebitda >= 0) {
          foundBreakEven = true;
          
          // Check if this matches stated break-even month
          if (!period.includes(break_even_month.substring(0, 7))) { // Check year-month
            issues.push({
              severity: "warning",
              section: "financial_plan",
              field: "break_even_month",
              issue: "Break-even month doesn't match EBITDA positive point in forecast",
              expected: `Around ${period}`,
              actual: break_even_month
            });
          }
          break;
        }
      }

      if (!foundBreakEven) {
        issues.push({
          severity: "info",
          section: "financial_plan", 
          field: "break_even_month",
          issue: "No positive EBITDA found in forecast period",
          expected: "Positive EBITDA within forecast",
          actual: "Always negative"
        });
      }
    }
  }

  private validateCrossSectionPlausibility(sections: Record<string, any>, issues: ValidationIssue[], warnings: string[]): void {
    // Team size vs revenue plausibility
    if (sections.team?.data?.org_chart && sections.financial_plan?.data?.forecast) {
      const teamSize = sections.team.data.org_chart.length;
      const forecastEntries = Object.entries(sections.financial_plan.data.forecast);
      
      if (forecastEntries.length > 0) {
        const lastYear = forecastEntries[forecastEntries.length - 1][1] as any;
        const finalRevenue = lastYear.revenue;
        
        if (finalRevenue && teamSize > 0) {
          const revenuePerEmployee = finalRevenue / teamSize;
          
          if (revenuePerEmployee < 100000) { // Less than 100k per employee
            warnings.push(`Revenue per employee (${Math.round(revenuePerEmployee)}€) seems low - consider team efficiency`);
          } else if (revenuePerEmployee > 500000) {
            warnings.push(`Revenue per employee (${Math.round(revenuePerEmployee)}€) seems very high - validate assumptions`);
          }
        }
      }
    }

    // Market share realism check
    if (sections.market?.data?.som_eur && sections.financial_plan?.data?.forecast) {
      const som = Array.isArray(sections.market.data.som_eur) ? sections.market.data.som_eur[0] : sections.market.data.som_eur;
      const forecastEntries = Object.entries(sections.financial_plan.data.forecast);
      
      if (forecastEntries.length > 0 && som > 0) {
        const finalYear = forecastEntries[forecastEntries.length - 1][1] as any;
        const finalRevenue = finalYear.revenue;
        
        if (finalRevenue > som * 0.5) { // More than 50% of SOM
          issues.push({
            severity: "warning",
            section: "financial_plan",
            field: "revenue_projection",
            issue: "Revenue projection exceeds 50% of SOM - may be overly optimistic",
            expected: `< ${Math.round(som * 0.5)}`,
            actual: finalRevenue
          });
        }
      }
    }
  }

  applyAutoFixes(sections: Record<string, any>, fixes: ValidationFix[]): Record<string, any> {
    const fixedSections = JSON.parse(JSON.stringify(sections)); // Deep clone
    
    for (const fix of fixes) {
      if (fix.confidence === "high") {
        // Parse path like "sections.business_model.data.CLV"
        const pathParts = fix.path.split('.');
        let current = fixedSections;
        
        for (let i = 1; i < pathParts.length - 1; i++) { // Skip first 'sections'
          current = current[pathParts[i]];
        }
        
        const finalKey = pathParts[pathParts.length - 1];
        current[finalKey] = fix.new_value;
        
        console.log(`🔧 Auto-fixed ${fix.path}: ${fix.current_value} → ${fix.new_value}`);
      }
    }
    
    return fixedSections;
  }
}
