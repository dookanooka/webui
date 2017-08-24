import {Injectable} from '@angular/core';

import {WebSocketService} from '../../../services/';
import {BaThemeConfigProvider, colorHelper, layoutPaths} from '../../../theme';


/*
 * Fed to the LineChart ./lineChart.component.ts
 */
export interface LineChartData {
  labels: Date[];
  series: any[];
}


/**
 * For a given chart.. This is each line on the chart.
 */
export interface DataListItem {
  source: string;
  type: string;
  dataset: string;
  jsonResponse?: any;
}


/**
 * name of plugin mapped to a series of charts (Each chart comprised of DataListItem[]
 */
export interface ChartSeries {
    rowMap: Map<string, ChartConfigData[]>;
}


/**
 * One Whole Charts worth of data
 */
export interface ChartConfigData {
  title: string;
  legends: string[];
  dataList: DataListItem[];
}


/**
 * Retunrs back the Series/Data Points for a given chart.
 */
export interface HandleDataFunc {
  handleDataFunc(lineChartData: LineChartData);

}

/**
 * Gets all the existing Collectd/Report RRD Sources with a high level list
 * Of children types: string[] Some charts/Metrics require more data..  And
 * Need to have additional ? optional parameters filled out... Via LineChartService.extendChartConfigData
 */
export interface HandleChartConfigDataFunc {
  handleChartConfigDataFunc(chartConfigData: ChartConfigData[]);
}


@Injectable()
export class LineChartService {

  private cacheConfigData: ChartConfigData[] = [];
  
  constructor(private _baConfig: BaThemeConfigProvider,
    private _ws: WebSocketService) {}

  public getData(dataHandlerInterface: HandleDataFunc, dataList: any[]) {

    this._ws.call('stats.get_data', [dataList, {}]).subscribe((res) => {
      let linechartData: LineChartData = {
        labels: new Array<Date>(),
        series: new Array<any>()
      }

      dataList.forEach(() => {linechartData.series.push([]);})
      res.data.forEach((item, i) => {
        linechartData.labels.push(
          new Date(res.meta.start * 1000 + i * res.meta.step * 1000));
        for (let x in dataList) {
          linechartData.series[x].push(item[x]);
        }
      });

      dataHandlerInterface.handleDataFunc(linechartData);
    });
  }


  public getChartConfigData(handleChartConfigDataFunc: HandleChartConfigDataFunc) {
    // Use this instead of the below.. TO just spoof the data
    // So you can see what the control looks like with no WS

    //this.getChartConfigDataSpoof(handleChartConfigDataFunc);

    this._ws.call('stats.get_sources').subscribe((res) => {
       this.cacheConfigData = this.chartConfigDataFromWsReponse(res);
       handleChartConfigDataFunc.handleChartConfigDataFunc(this.cacheConfigData);
    });
  }
  
  private getCacheConfigDataByTitle(title:string): ChartConfigData {
     let chartConfigData: ChartConfigData = null;
    
    for( let cacheConfigDataItem of this.cacheConfigData ) {
        if( title === cacheConfigDataItem.title ) {
            chartConfigData = cacheConfigDataItem;
            break;
        }
    }
    
    return chartConfigData;
  }

  public extendChartConfigData(chartConfigTitle: string, handleChartConfigDataFunc: HandleChartConfigDataFunc) {
    let count: number = 0;
    let chartConfigData: ChartConfigData = this.getCacheConfigDataByTitle(chartConfigTitle);
    
    if( chartConfigData === null || typeof(chartConfigData) === 'undefined' ) {
      return;
    }
    
    if( chartConfigData.dataList.length > 0 && 
          chartConfigData.dataList[0].jsonResponse !== null &&
            typeof(chartConfigData.dataList[0].jsonResponse) !== 'undefined' ) {
        // Then this was already done.. Just use the data, spare the webservice dall.
        // because the client expects notification
         setTimeout(() => {
            handleChartConfigDataFunc.handleChartConfigDataFunc(this.cacheConfigData);
          }, -1)
          return;
    }

    chartConfigData.dataList.forEach((dataListItem: DataListItem) => {
    let storeDataListItem: DataListItem = dataListItem;
    
    this._ws.call('stats.get_dataset_info', [dataListItem.source, dataListItem.type]).subscribe((res) => {
      storeDataListItem.jsonResponse = res;
      handleChartConfigDataFunc.handleChartConfigDataFunc(this.cacheConfigData);
    });

    });
  }

  private chartConfigDataFromWsReponse(res): ChartConfigData[] {
    let configData: ChartConfigData[] = [];
    let properties: string[] = [];
    for (let prop in res) {
      properties.push(prop);
    }

    properties = properties.sort();

    for (let prop of properties) {
      var propObjArray: string[] = res[prop];
      var dataListItemArray: DataListItem[] = [];

      propObjArray.forEach((proObjArrayItem) => {

        let dataListItem: DataListItem = {
          source: prop,
          type: proObjArrayItem,
          dataset: 'value'
        };

        dataListItemArray.push(dataListItem);
      });

      let chartData: ChartConfigData = {
        title: prop,
        legends: propObjArray,
        dataList: dataListItemArray
      };

      configData.push(chartData);

    }

    return configData;
  }


  private getChartConfigDataSpoof(handleChartConfigDataFunc: HandleChartConfigDataFunc) {

    let configData: ChartConfigData[] = [];

    let spoofData: ChartConfigData[] = [
      {
        title: "Average Load",
        legends: ['Short Term', ' Mid Term', 'Long Term'],
        dataList: [
          {source: 'load', type: 'load', dataset: 'shortterm'},
          {'source': 'load', 'type': 'load', 'dataset': 'midterm'},
          {'source': 'load', 'type': 'load', 'dataset': 'longterm'},
        ],
      },
      {
        title: "Memory",
        legends: ['Free', 'Active', 'Cache', 'Wired', 'Inactive'],
        dataList: [
          {'source': 'memory', 'type': 'memory-free', 'dataset': 'value'},
          {'source': 'memory', 'type': 'memory-active', 'dataset': 'value'},
          {'source': 'memory', 'type': 'memory-cache', 'dataset': 'value'},
          {'source': 'memory', 'type': 'memory-wired', 'dataset': 'value'},
          {'source': 'memory', 'type': 'memory-inactive', 'dataset': 'value'},
        ],
      },
      {
        title: "CPU Usage",
        legends: ['User', 'Interrupt', 'System', 'Idle', 'Nice'],
        dataList: [
          {
            'source': 'aggregation-cpu-sum',
            'type': 'cpu-user',
            'dataset': 'value'
          },
          {
            'source': 'aggregation-cpu-sum',
            'type': 'cpu-interrupt',
            'dataset': 'value'
          },
          {
            'source': 'aggregation-cpu-sum',
            'type': 'cpu-system',
            'dataset': 'value'
          },
          {
            'source': 'aggregation-cpu-sum',
            'type': 'cpu-idle',
            'dataset': 'value'
          },
          {
            'source': 'aggregation-cpu-sum',
            'type': 'cpu-nice',
            'dataset': 'value'
          },
        ],
      }
    ];

    setTimeout(() => {
      handleChartConfigDataFunc.handleChartConfigDataFunc(spoofData);
    }, -1)

  }

}