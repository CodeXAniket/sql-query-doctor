import type { PlanEngine } from "./types";

/**
 * Realistic sample EXPLAIN outputs for each engine, powering the "Load example"
 * buttons and the parser test suite. Each represents the same logical query:
 *   SELECT u.name, COUNT(*) FROM orders o JOIN users u ON o.user_id = u.id
 *   WHERE o.amount > 100 GROUP BY u.name ORDER BY 2 DESC;
 * and each contains a deliberate hot spot (a large scan) for the visualizer.
 */
export const PLAN_SAMPLES: Record<PlanEngine, string> = {
  postgresql: JSON.stringify(
    [
      {
        Plan: {
          "Node Type": "Aggregate",
          "Total Cost": 24500.5,
          "Plan Rows": 1,
          "Actual Rows": 1,
          "Actual Total Time": 210.5,
          "Actual Loops": 1,
          Plans: [
            {
              "Node Type": "Hash Join",
              "Join Type": "Inner",
              "Total Cost": 24000.0,
              "Plan Rows": 500,
              "Actual Rows": 8200,
              "Actual Total Time": 205.0,
              "Actual Loops": 1,
              "Hash Cond": "(o.user_id = u.id)",
              Plans: [
                {
                  "Node Type": "Seq Scan",
                  "Relation Name": "orders",
                  Alias: "o",
                  "Total Cost": 18000.0,
                  "Plan Rows": 500000,
                  "Actual Rows": 500000,
                  "Actual Total Time": 120.0,
                  "Actual Loops": 1,
                  Filter: "(amount > 100)",
                },
                {
                  "Node Type": "Hash",
                  "Total Cost": 3000.0,
                  "Plan Rows": 100000,
                  "Actual Rows": 100000,
                  "Actual Total Time": 40.0,
                  "Actual Loops": 1,
                  Plans: [
                    {
                      "Node Type": "Seq Scan",
                      "Relation Name": "users",
                      Alias: "u",
                      "Total Cost": 3000.0,
                      "Plan Rows": 100000,
                      "Actual Rows": 100000,
                      "Actual Total Time": 20.0,
                      "Actual Loops": 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
    null,
    2,
  ),

  mysql: JSON.stringify(
    {
      query_block: {
        select_id: 1,
        cost_info: { query_cost: "12500.00" },
        ordering_operation: {
          using_filesort: true,
          nested_loop: [
            {
              table: {
                table_name: "orders",
                access_type: "ALL",
                rows_examined_per_scan: 500000,
                rows_produced_per_join: 50000,
                filtered: "10.00",
                cost_info: {
                  read_cost: "9000.00",
                  eval_cost: "1000.00",
                  prefix_cost: "10000.00",
                },
                attached_condition: "(orders.amount > 100)",
              },
            },
            {
              table: {
                table_name: "users",
                access_type: "eq_ref",
                key: "PRIMARY",
                used_key_parts: ["id"],
                rows_examined_per_scan: 1,
                rows_produced_per_join: 50000,
                cost_info: {
                  read_cost: "1500.00",
                  eval_cost: "1000.00",
                  prefix_cost: "12500.00",
                },
              },
            },
          ],
        },
      },
    },
    null,
    2,
  ),

  sqlserver: `<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan">
  <BatchSequence><Batch><Statements>
    <StmtSimple StatementText="SELECT u.name, COUNT(*) ...">
      <QueryPlan>
        <RelOp PhysicalOp="Hash Match" LogicalOp="Aggregate" EstimateRows="500" EstimatedTotalSubtreeCost="24.5">
          <Hash>
            <RelOp PhysicalOp="Table Scan" LogicalOp="Table Scan" EstimateRows="500000" EstimatedTotalSubtreeCost="18.0">
              <TableScan><Object Table="[orders]" /></TableScan>
              <RunTimeInformation><RunTimeCountersPerThread ActualRows="500000" /></RunTimeInformation>
            </RelOp>
            <RelOp PhysicalOp="Index Seek" LogicalOp="Index Seek" EstimateRows="100000" EstimatedTotalSubtreeCost="3.0">
              <IndexScan><Object Table="[users]" Index="[PK_users]" /></IndexScan>
              <RunTimeInformation><RunTimeCountersPerThread ActualRows="100000" /></RunTimeInformation>
            </RelOp>
          </Hash>
        </RelOp>
      </QueryPlan>
    </StmtSimple>
  </Statements></Batch></BatchSequence>
</ShowPlanXML>`,

  sqlite: `QUERY PLAN
|--SCAN orders
|--SEARCH users USING INTEGER PRIMARY KEY (rowid=?)
\`--USE TEMP B-TREE FOR ORDER BY`,
};
