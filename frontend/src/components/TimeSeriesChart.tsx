import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const TimeSeriesChart: React.FC = () => {
  const data = useMemo(() => {
    // Generate mock data - in production this comes from Zenoh
    const labels = Array.from({ length: 50 }, (_, i) => `${i}s`)
    const generateData = (base: number, variance: number) =>
      Array.from({ length: 50 }, () => base + Math.random() * variance - variance / 2)

    return {
      labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: generateData(72, 10),
          borderColor: '#6EC72D',
          backgroundColor: 'rgba(110, 199, 45, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Pressure (PSI)',
          data: generateData(1000, 100),
          borderColor: '#3498DB',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Vibration (Hz)',
          data: generateData(50, 20),
          borderColor: '#E67E22',
          backgroundColor: 'rgba(230, 126, 34, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    }
  }, [])

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#ffffff',
          font: {
            size: 11,
            weight: 600,
          },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        titleColor: '#6EC72D',
        bodyColor: '#ffffff',
        borderColor: '#6EC72D',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawTicks: false,
        },
        ticks: {
          color: '#b0b0b0',
          font: {
            size: 10,
          },
          maxTicksLimit: 10,
        },
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawTicks: false,
        },
        ticks: {
          color: '#b0b0b0',
          font: {
            size: 10,
          },
        },
      },
    },
  }

  return <Line data={data} options={options} />
}

export default TimeSeriesChart
