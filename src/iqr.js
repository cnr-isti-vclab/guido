
class Iqr{
  getQuartiles(data) {
    const sortedData = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sortedData.length / 2);

    const q1 = this.median(sortedData.slice(0, mid));
    const q3 = this.median(
        sortedData.length % 2 === 0
            ? sortedData.slice(mid)
            : sortedData.slice(mid + 1)
    );

    return { q1, q3 };
}

// Funzione per calcolare la mediana
  median(data) {
    const sortedData = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sortedData.length / 2);

    if (data.length % 2 === 0) {
        return (sortedData[mid - 1] + sortedData[mid]) / 2;
    } else {
        return sortedData[mid];
    }
}

// Funzione per filtrare gli outlier
  removeOutliers(data) {
    const { q1, q3 } = this.getQuartiles(data);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return data.filter(value => value >= lowerBound && value <= upperBound);
}

  mean(data) {
    const sum = data.reduce((acc, value) => acc + value, 0);
    return sum / data.length;
}

  estimate(data){
     this.removeOutliers(data);
     return this.mean(data);
}
}

export {Iqr}
