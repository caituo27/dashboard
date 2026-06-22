import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import type { Dimension, EvaluationResult } from "../types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

interface Props {
  dimensions: Dimension[];
  result: EvaluationResult;
}

export function RadarChart({ dimensions, result }: Props) {
  const labels = dimensions.map((d) => d.label);
  const data = dimensions.map((d) => Number(result.dimensions[d.key]?.score) || 0);

  return (
    <Radar
      data={{
        labels,
        datasets: [
          {
            label: "评分",
            data,
            fill: true,
            backgroundColor: "rgba(165, 180, 252, 0.25)",
            borderColor: "rgba(129, 140, 248, 0.9)",
            borderWidth: 2,
            pointBackgroundColor: "#818cf8",
            pointBorderColor: "#fff",
            pointRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: "#9a9a9a",
              backdropColor: "transparent",
              font: { size: 10 },
            },
            grid: { color: "#ececea" },
            angleLines: { color: "#ececea" },
            pointLabels: { color: "#4a4a4a", font: { size: 13 } },
          },
        },
        plugins: { legend: { display: false } },
      }}
    />
  );
}
