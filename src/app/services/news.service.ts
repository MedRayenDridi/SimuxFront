import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface CryptoNews {
  id: string;
  title: string;
  source: string;
  publishedAt: Date;
  url: string;
  categories: string[];
  imageUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private readonly apiUrl = 'https://min-api.cryptocompare.com/data/v2/news/';

  constructor(private http: HttpClient) {}

  getLatestNews(limit = 8, categories?: string): Observable<CryptoNews[]> {
    let params = new HttpParams()
      .set('lang', 'EN')
      .set('sortOrder', 'latest')
      .set('limit', limit.toString());

    if (categories && categories !== 'all') {
      params = params.set('categories', categories);
    }

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(response =>
        (response?.Data || []).map((item: any) => ({
          id: item.id?.toString() || item.guid,
          title: item.title,
          source: item.source_info?.name || item.source || 'Unknown',
          publishedAt: new Date((item.published_on || 0) * 1000),
          url: item.url,
          categories: typeof item.categories === 'string' && item.categories.length
            ? item.categories.split('|').map((cat: string) => cat.trim()).filter(Boolean)
            : [],
          imageUrl: item.imageurl
        }))
      )
    );
  }
}

