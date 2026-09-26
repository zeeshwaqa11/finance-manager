import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useChartTheme } from '../hooks/useChartTheme.js';
import { formatMoney, formatMoneyWhole, formatMonth } from '../utils/format.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const centerLabelPlugin = {
  id: 'centerLabel',
  afterDraw(chart, args, options) {
    const arc = chart.getDatasetMeta(0).data[0];
    if (!arc || !options?.value) return;
    const { x, y, innerRadius } = arc;
    const ctx = chart.ctx;
    const maxWidth = innerRadius * 1.6;
    let size = 22;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    do {
      ctx.font = `700 ${size}px ${FONT}`;
      size -= 1;
    } while (ctx.measureText(options.value).width > maxWidth && size > 10);
    ctx.fillStyle = options.valueColor;
    ctx.fillText(options.value, x, y + 10);
    ctx.font = `500 12px ${FONT}`;
    ctx.fillStyle = options.labelColor;
    ctx.fillText(options.label, x, y - 12);
    ctx.restore();
  },
};

const CENTER_PLUGINS = [centerLabelPlugin];

export function SpendingDoughnut({ items, colors, total }) {
  const theme = useChartTheme();
  const totalLabel = formatMoney(total ?? items.reduce((sum, i) => sum + i.value, 0));

  const data = {
    labels: items.map((i) => i.name),
    datasets: [
      {
        data: items.map((i) => i.value),
        backgroundColor: items.map((i) => colors.get(i.id) ?? theme.muted),
        borderColor: theme.surface,
        borderWidth: 3,
        borderRadius: 6,
        hoverOffset: 6,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    layout: { padding: 8 },
    plugins: {
      legend: { display: false },
      centerLabel: { label: 'Total spent', value: totalLabel, valueColor: theme.ink, labelColor: theme.ink2 },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.parsed)}` } },
    },
  };
  return <Doughnut data={data} options={options} plugins={CENTER_PLUGINS} />;
}

export function TrendBars({ trend, selectedMonth }) {
  const theme = useChartTheme();
  const main = theme.series[0];
  const data = {
    labels: trend.map((t) => formatMonth(t.month, { short: true })),
    datasets: [
      {
        data: trend.map((t) => t.totalExpenses),
        backgroundColor: (context) => {
          if (trend[context.dataIndex]?.month !== selectedMonth) return `${main}55`;
          const area = context.chart.chartArea;
          if (!area) return main;
          const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
          gradient.addColorStop(0, main);
          gradient.addColorStop(1, `${main}99`);
          return gradient;
        },
        borderRadius: { topLeft: 8, topRight: 8 },
        maxBarThickness: 48,
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
        ticks: { color: theme.muted, maxTicksLimit: 6, callback: (v) => formatMoneyWhole(v) },
      },
    },
  };
  return <Bar data={data} options={options} />;
}
