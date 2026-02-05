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

export type Record = {
  date: Date;
  weight: number;
}

@Component({
  selector: 'app-root',
  imports: [MatToolbarModule, MatIconModule, MatButtonModule, MatTableModule, DatePipe, NgxEchartsDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  dialog = inject(MatDialog);
  displayedColumns: string[] = ['date', 'weight'];
  activePage = signal<'table' | 'chart'>('table');
  viewMode = signal<'all' | 'month'>('all');
  goalWeight = signal(90);
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
  chartOptions = computed<EChartsOption>(() => {
    const data = this.viewMode() === 'all' ? this.sortedEntries() : this.monthlyEntries();
    // const dates = data.map(d => {
    //   // Se sua interface WeightEntry usa string (ISO), converta para Date antes
    //   const dateObj = typeof d.date === 'string' ? new Date(d.date) : d.date;
      
    //   // Retorna string formatada (ex: "05/02")
    //   return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    // })
    // const weights = data.map(d => d.weight);
    const seriesData = data.map(({date, weight}) => ([date, weight] as [Date, number]));
    
    // const goal = this.goalWeight();
    const final = this.goalWeight();
    const short = this.goalWeight() + 10;

    const markLineData = [];

    if (short !== null) {
      markLineData.push({
        yAxis: short,
        name: 'Curto Prazo',
        // Adicionado 'as const' no position
        label: { formatter: 'Parcial: {c}kg', position: 'insideEnd' as const, color: '#e6a23c' },
        lineStyle: { 
          color: '#e6a23c', 
          // O CORREÇÃO PRINCIPAL ESTÁ AQUI:
          type: 'dashed' as const, 
          width: 2 
        }
      });
    }

    if (final !== null) {
      markLineData.push({
        yAxis: final,
        name: 'Final',
        // Adicionado 'as const' no position
        label: { formatter: 'Final: {c}kg', position: 'insideEnd' as const, fontWeight: 'bold' as const, color: 'green' },
        lineStyle: { 
          color: 'green', 
          // E AQUI TAMBÉM:
          type: 'solid' as const, 
          width: 2 
        }
      });
    }

    // 2. Lógica do Minimo: Pega o menor valor entre as duas metas (se existirem)
    // Isso garante que o gráfico desça até a meta mais baixa.
    let lowestGoal: number | undefined = undefined;
    if (final !== null && short !== null) lowestGoal = Math.min(final, short);
    else if (final !== null) lowestGoal = final;
    else if (short !== null) lowestGoal = short;

    return {
      tooltip: {
        trigger: 'axis',
        // formatter: '{b}: {c} kg'
        formatter: (params: any) => {
          // Como o dado agora é um array [data, peso], o valor vem diferente no params
          const item = Array.isArray(params) ? params[0] : params;
          const date = item.value[0];  // Índice 0 é a data
          const weight = item.value[1]; // Índice 1 é o peso
          
          // Formatamos a data bonitinha para o Tooltip
          const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          return `${dateStr}<br/><strong>${weight} kg</strong>`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      // xAxis: {
      //   type: 'category',
      //   boundaryGap: false,
      //   data: dates,
      // },
      xAxis: {
        type: 'time', // <--- A MÁGICA ACONTECE AQUI
        // boundaryGap: false,
        // boundaryGap: ['0%','0%'],
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
        scale: lowestGoal === undefined,
        min: lowestGoal! - 5,
        axisLabel: { formatter: '{value} kg' }
      },
      series: [
        {
          name: 'Peso',
          type: 'line',
          // data: weights,
          data: seriesData,
          smooth: false, // Deixa a linha curva
          connectNulls: true, // Garante que a linha desenhe mesmo se tiver buracos (opcional)
          // lineStyle: { width: 3, color: '#5470C6' },
          // areaStyle: { opacity: 0.3, color: '#5470C6' },
          lineStyle: { width: 3, color: '#5470C6' },
          areaStyle: { 
            // Gradiente para ficar bonito
            opacity: 0.3, 
            color: '#5470C6' 
          },
          symbol: 'circle',
          symbolSize: 8,
          // markPoint: {
          //   data: [
          //     { type: 'max', name: 'Máx' },
          //     { type: 'min', name: 'Mín' }
          //   ]
          // }

          // markLine: goal ? {
          //   data: [{ yAxis: goal, name: 'Meta' }],
          //   symbol: 'none',
          //   label: { formatter: 'Meta:', position: 'insideEnd' },
          //   lineStyle: { color: 'green', type: 'dashed' },
          // } : undefined

          // AQUI passamos o array com as duas linhas
          markLine: {
            symbol: ['none', 'none'], // Remove as setas nas pontas das linhas
            data: markLineData,
            animation: true
          }
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
