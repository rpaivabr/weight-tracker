import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTableModule } from '@angular/material/table';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Dialog } from './dialog/dialog';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';
import { FormsModule } from '@angular/forms';

export type Record = {
  date: Date;
  weight: number;
}

@Component({
  selector: 'app-root',
  imports: [MatToolbarModule, MatIconModule, MatButtonModule, MatTableModule, DatePipe, NgxEchartsDirective, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  dialog = inject(MatDialog);
  displayedColumns: string[] = ['date', 'weight'];
  activePage = signal<'table' | 'chart'>('chart');
  viewMode = signal<'all' | 'week' | 'month'>('all');
  // goalWeight = signal(90);
  finalGoal = signal(90);
  // Computed apenas para mostrar o texto da data na tela
  predictionInfo = computed(() => {
    const goal = this.finalGoal();
    if (!goal) return null;
    
    const date = this.predictCompletionDate(goal);
    if (!date) return 'Sem tendência de queda';
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  });
  entries = signal<Record[]>(JSON.parse(localStorage.getItem('app-weight-tracker') ?? '[]').map(({ date, weight }: any) => ({ date: new Date(date), weight})));
  sortedEntries = computed(() => this.entries().sort((a, b) => b.date.getTime() - a.date.getTime()));
  monthlyEntries = computed(() => {
    const all = this.sortedEntries();
    const map = new Map<string, Record>();
    all.forEach((entry) => {
      const key = `${entry.date.getFullYear()}-${entry.date.getMonth()}`;
      if (!map.has(key)) map.set(key, entry)
    })
    return Array.from(map.values());
  })
  weeklyEntries = computed(() => {
    const all = this.sortedEntries();
    const map = new Map<string, Record>();

    const getWeekNumber = (d: Date) => {
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    let yearStart = new Date(d.getFullYear(),0,1);
    let weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
}
    all.forEach((entry) => {
      const key = `${entry.date.getFullYear()}-${getWeekNumber(entry.date)}`;
      if (!map.has(key)) map.set(key, entry)
    })
    return Array.from(map.values());
  })
  predictCompletionDate(goalWeight: number): Date | null {
    const data = this.sortedEntries();
    if (data.length < 2) return null; // Precisa de min 2 pontos para traçar reta

    // Pegamos apenas as últimas X entradas para a previsão ser mais realista (tendência atual)
    // Ex: Últimas 10 pesagens. Se usar todas, uma perda antiga lenta distorce a nova rápida.
    const recentData = data.slice(-10); 

    // Prepara dados para regressão (X = Timestamp, Y = Peso)
    const n = recentData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (const entry of recentData) {
      const x = new Date(entry.date).getTime();
      const y = entry.weight;
      
      sumX += x;
      sumY += y;
      sumXY += (x * y);
      sumXX += (x * x);
    }

    // Fórmulas da Regressão Linear (Slope 'm' e Intercept 'b')
    // y = mx + b  ->  weight = (slope * time) + intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Se slope >= 0, você não está emagrecendo (está mantendo ou subindo), impossível prever data
    if (slope >= 0) return null;

    // Queremos saber o X (data) quando Y for o goalWeight
    // goalWeight = slope * targetDate + intercept
    // targetDate = (goalWeight - intercept) / slope
    const targetTime = (goalWeight - intercept) / slope;

    // Se a data for no passado (ex: meta já batida matematicamente), retornamos hoje
    if (targetTime < new Date().getTime()) return new Date();

    return new Date(targetTime);
  }
  
  chartOptions = computed<EChartsOption>(() => {
    const data = this.viewMode() === 'all' 
      ? this.sortedEntries() 
      : this.viewMode() === 'week' 
        ? this.weeklyEntries() 
        : this.monthlyEntries();
    // const dates = data.map(d => {
    //   // Se sua interface WeightEntry usa string (ISO), converta para Date antes
    //   const dateObj = typeof d.date === 'string' ? new Date(d.date) : d.date;
      
    //   // Retorna string formatada (ex: "05/02")
    //   return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    // })
    // const weights = data.map(d => d.weight);
    const seriesData = data.map(({date, weight}) => ([date, weight] as [Date, number]));
    
    // const goal = this.goalWeight();
    // const final = this.goalWeight();
    // const short = this.goalWeight() + 10;
    const goal = this.finalGoal();

    let projectedData: [Date, number][] = [];
    let predictedDate: Date | null = null;

    if (goal !== null && seriesData.length >= 2) {
      predictedDate = this.predictCompletionDate(goal);
      
      if (predictedDate) {
        // Pega o último ponto real para conectar a linha
        const lastRealPoint = seriesData[seriesData.length - 1];
        
        projectedData = [
          lastRealPoint, // Ponto de partida (última pesagem)
          [predictedDate, goal] // Ponto de chegada (data prevista, peso meta)
        ];
      }
    }

    // const markLineData = [];

    // if (short !== null) {
    //   markLineData.push({
    //     yAxis: short,
    //     name: 'Curto Prazo',
    //     // Adicionado 'as const' no position
    //     label: { formatter: 'Parcial: {c}kg', position: 'insideEnd' as const, color: '#e6a23c' },
    //     lineStyle: { 
    //       color: '#e6a23c', 
    //       // O CORREÇÃO PRINCIPAL ESTÁ AQUI:
    //       type: 'dashed' as const, 
    //       width: 2 
    //     }
    //   });
    // }

    // if (final !== null) {
    //   markLineData.push({
    //     yAxis: final,
    //     name: 'Final',
    //     // Adicionado 'as const' no position
    //     label: { formatter: 'Final: {c}kg', position: 'insideEnd' as const, fontWeight: 'bold' as const, color: 'green' },
    //     lineStyle: { 
    //       color: 'green', 
    //       // E AQUI TAMBÉM:
    //       type: 'solid' as const, 
    //       width: 2 
    //     }
    //   });
    // }

    // // 2. Lógica do Minimo: Pega o menor valor entre as duas metas (se existirem)
    // // Isso garante que o gráfico desça até a meta mais baixa.
    // let lowestGoal: number | undefined = undefined;
    // if (final !== null && short !== null) lowestGoal = Math.min(final, short);
    // else if (final !== null) lowestGoal = final;
    // else if (short !== null) lowestGoal = short;

    return {
      tooltip: {
        trigger: 'axis',
        // formatter: '{b}: {c} kg'
        // formatter: (params: any) => {
        //   // Como o dado agora é um array [data, peso], o valor vem diferente no params
        //   const item = Array.isArray(params) ? params[0] : params;
        //   const date = item.value[0];  // Índice 0 é a data
        //   const weight = item.value[1]; // Índice 1 é o peso
          
        //   // Formatamos a data bonitinha para o Tooltip
        //   const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        //   return `${dateStr}<br/><strong>${weight} kg</strong>`;
        // }
        formatter: (params: any) => {
          // Lógica para formatar tooltip combinando as séries se necessário
          let res = '';
          const p = Array.isArray(params) ? params[0] : params;
          const date = new Date(p.value[0]);
          const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          
          // Se for o ponto da projeção (série index 1)
          if (p.seriesIndex === 1 && p.dataIndex === 1) {
            res = `${dateStr} (Estimado)<br/><strong>🎯 Meta: ${p.value[1]} kg</strong>`;
          } else {
            res = `${dateStr}<br/><strong>${p.value[1]} kg</strong>`;
          }
          return res;
        }
      },
      // grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
      // xAxis: {
      //   type: 'category',
      //   boundaryGap: false,
      //   data: dates,
      // },
      xAxis: {
        type: 'time', // <--- A MÁGICA ACONTECE AQUI
        // boundaryGap: false,
        boundaryGap: ['0%','0%'],
        // Opcional: Forçar formato do label no eixo
        // axisLabel: {
        //   formatter: {
        //     year: '{yyyy}',
        //     month: '{MMM}',
        //     day: '{d}/{MM}'
        //   }
        // }
        axisLabel: {
          // Usamos uma função para formatar TODOS os labels do eixo X
          formatter: (value: number) => {
            const date = new Date(value);
            // Retorna apenas "05/02/2026"
            return date.toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit', 
              // year: '2-digit' // ou 'numeric' para 2026 completo
            });
          },
          // Opcional: Rotaciona o texto se ficar muito apertado
          rotate: 45, 
          hideOverlap: true // Esconde labels que iriam ficar um em cima do outro
        }
      },
      yAxis: {
        type: 'value',
        // scale: goal === null,
        // min: goal !== null ? goal - 5 : undefined,
        // scale: lowestGoal === undefined,
        // min: lowestGoal! - 5,
        scale: goal === null,
        min: goal !== null ? goal : undefined,
        axisLabel: { formatter: '{value} kg' }
      },
      // series: [
      //   {
      //     name: 'Peso',
      //     type: 'line',
      //     // data: weights,
      //     data: seriesData,
      //     smooth: false, // Deixa a linha curva
      //     connectNulls: true, // Garante que a linha desenhe mesmo se tiver buracos (opcional)
      //     // lineStyle: { width: 3, color: '#5470C6' },
      //     // areaStyle: { opacity: 0.3, color: '#5470C6' },
      //     lineStyle: { width: 3, color: '#5470C6' },
      //     areaStyle: { 
      //       // Gradiente para ficar bonito
      //       opacity: 0.3, 
      //       color: '#5470C6' 
      //     },
      //     symbol: 'circle',
      //     symbolSize: 8,
      //     // markPoint: {
      //     //   data: [
      //     //     { type: 'max', name: 'Máx' },
      //     //     { type: 'min', name: 'Mín' }
      //     //   ]
      //     // }

      //     // markLine: goal ? {
      //     //   data: [{ yAxis: goal, name: 'Meta' }],
      //     //   symbol: 'none',
      //     //   label: { formatter: 'Meta:', position: 'insideEnd' },
      //     //   lineStyle: { color: 'green', type: 'dashed' },
      //     // } : undefined

      //     // AQUI passamos o array com as duas linhas
      //     // markLine: {
      //     //   symbol: ['none', 'none'], // Remove as setas nas pontas das linhas
      //     //   data: markLineData,
      //     //   animation: true
      //     // }
      //   }
      // ]
      series: [
        // SÉRIE 1: Histórico (Sólida com Área pintada)
        {
          name: 'Histórico',
          type: 'line',
          data: seriesData,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#5470C6' },
          areaStyle: { opacity: 0.3, color: '#5470C6' }
        },
        // SÉRIE 2: Projeção (Pontilhada sem Área)
        {
          name: 'Previsão',
          type: 'line',
          data: projectedData,
          smooth: false, // Reta direta é melhor para projeção linear
          symbol: 'emptyCircle', // Símbolo diferente para indicar futuro
          symbolSize: 6,
          lineStyle: { 
            width: 2, 
            color: '#28a745', // Verde esperança
            type: 'dashed' as const 
          },
          areaStyle: undefined // Importante: Sem areaStyle
        }
      ]
    }
  })
  localStorageEffect = effect(() => {
    localStorage.setItem('app-weight-tracker', JSON.stringify(this.entries()));
  })
  openDialog(index?: number) {
    const data = index === undefined ? undefined : this.entries()[index];
    this.dialog
      .open(Dialog, { data })
      .afterClosed().subscribe((result: Record | undefined | null) => {
        console.log(result);
        if (result === undefined) return;
        if (result === null) {
          this.entries.update(values => values.filter((value, i) => i !== index));
          return;
        }
        const newEntries = [...this.entries()];
        if (index !== undefined && index >= 0) {
          newEntries[index] = {...result};
        } else {
          newEntries.push(result);
        }
        console.log(newEntries);
        this.entries.set(newEntries);
      });
  }
}
