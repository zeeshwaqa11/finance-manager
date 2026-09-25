import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useChartTheme } from '../hooks/useChartTheme.js';
import { formatMoney, formatMonth } from '../utils/format.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);

export function SpendingDoughnut({ items, colors }) {
  const theme = useChartTheme();
  const data = {
    labels: items.map((i) => i.name),
    datasets: [
      {
        data: items.map((i) => i.value),
        backgroundColor: items.map((i) => colors.get(i.id) ?? theme.muted),
        borderColor: theme.surface,
        borderWidth: 2,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.parsed)}` } },
    },
  };
  return <Doughnut data={data} options={options} />;
}

export function TrendBars({ trend, selectedMonth }) {
  const theme = useChartTheme();
  const main = theme.series[0];
  const data = {
    labels: trend.map((t) => formatMonth(t.month, { short: true })),
    datasets: [
      {
        data: trend.map((t) => t.totalExpenses),
        backgroundColor: trend.map((t) => (t.month === selectedMonth ? main : `${main}66`)),
        borderRadius: { topLeft: 4, topRight: 4 },
        maxBarThickness: 56,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => formatMonth(trend[items[0].dataIndex].month),
          label: (ctx) => ` Spending: ${formatMoney(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.muted }, border: { color: theme.grid } },
      y: {
        beginAtZero: true,
        grid: { color: theme.grid },
        border: { display: false },
        ticks: { color: theme.muted, callback: (v) => formatMoney(v).replace('.00', '') },
      },
    },
  };
  return <Bar data={data} options={options} />;
}
