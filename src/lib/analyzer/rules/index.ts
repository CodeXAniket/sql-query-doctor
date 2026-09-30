import type { Rule } from "../types";
import {
  leadingWildcardLike,
  nonSargableFunction,
  implicitConversion,
  orInWhere,
  inequalityOperator,
  likeNoWildcard,
  havingWithoutAggregate,
} from "./indexUsage";
import { notInSubquery, inSubquery, scalarSubqueryInSelect, implicitCrossJoin } from "./joins";
import { selectStar, selectDistinct } from "./projection";
import { orderByRandom, limitWithoutOrderBy } from "./sorting";
import { largeOffset } from "./pagination";
import { unionInsteadOfUnionAll } from "./setOps";
import { missingWhereDml, equalsNull } from "./correctness";

/**
 * The full anti-pattern rule catalog (19 rules). Order here is only the catalog
 * display order; findings are sorted by source position + severity at runtime.
 */
export const ALL_RULES: Rule[] = [
  // Index usage
  leadingWildcardLike,
  nonSargableFunction,
  implicitConversion,
  orInWhere,
  inequalityOperator,
  likeNoWildcard,
  havingWithoutAggregate,
  // Joins / subqueries
  notInSubquery,
  inSubquery,
  scalarSubqueryInSelect,
  implicitCrossJoin,
  // Projection
  selectStar,
  selectDistinct,
  // Sorting
  orderByRandom,
  limitWithoutOrderBy,
  // Pagination
  largeOffset,
  // Set operations
  unionInsteadOfUnionAll,
  // Correctness
  missingWhereDml,
  equalsNull,
];

export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(
  ALL_RULES.map((r) => [r.id, r]),
);
