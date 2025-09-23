import { Routes } from '@angular/router';
import { LoginRegisterComponent } from './components/login-register/login-register.component';
import { HomeComponent } from './components/home/home.component';
import { SearchComponent } from './components/search/search.component';
import { FilmInformationComponent } from './components/film-information/film-information.component';
import { RateFilmComponent } from './components/rate-film/rate-film.component';
import { EditFilmRatingComponent } from './components/edit-film-rating/edit-film-rating.component';
import { FilmsLibraryComponent } from './components/films-library/films-library.component';
import { FilmsSummaryComponent } from './components/films-summary/films-summary.component';


export const routes: Routes = [
    { path: '', component: LoginRegisterComponent },
    
    { path: 'home', component: HomeComponent },

    { path: 'search', redirectTo: 'search/movies', pathMatch: 'full' },
    { path: 'search/:type', component: SearchComponent },  ///  movies | series | users  \\\
    { path: 'movie/:imdbId', component: FilmInformationComponent },
    { path: 'series/:imdbId', component: FilmInformationComponent },
    { path: 'rate/:type/:imdbId', component: RateFilmComponent },   ///  movies | series  \\\

    { path: 'movies/library', component: FilmsLibraryComponent, data: { kind: 'movie' } },
    { path: 'movies/summary', component: FilmsSummaryComponent, data: { kind: 'movie' } },

    { path: 'shows/library', component: FilmsLibraryComponent, data: { kind: 'series' } },
    { path: 'shows/summary', component: FilmsSummaryComponent, data: { kind: 'series' } },

    { path: 'edit/:type/:postId', component: EditFilmRatingComponent },


    { path: '**', redirectTo: '' },
];