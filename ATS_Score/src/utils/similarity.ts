/**
 * Compute Jaccard similarity between two sets.
 * Returns a value between 0 and 1.
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  const smaller = setA.size <= setB.size ? setA : setB;
  const larger = setA.size <= setB.size ? setB : setA;

  for (const item of smaller) {
    if (larger.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Compute intersection of two sets.
 */
export function setIntersection(setA: Set<string>, setB: Set<string>): Set<string> {
  const result = new Set<string>();
  const smaller = setA.size <= setB.size ? setA : setB;
  const larger = setA.size <= setB.size ? setB : setA;

  for (const item of smaller) {
    if (larger.has(item)) {
      result.add(item);
    }
  }

  return result;
}

/**
 * Compute difference: items in setA that are not in setB.
 */
export function setDifference(setA: Set<string>, setB: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const item of setA) {
    if (!setB.has(item)) {
      result.add(item);
    }
  }
  return result;
}
