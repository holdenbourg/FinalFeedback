import { Routes } from '@angular/router';
import { LoginRegisterComponent } from './components/login-register/login-register.component';
import { HomeComponent } from './components/home/home.component';
import { SearchComponent } from './components/search/search.component';
import { FilmInformationComponent } from './components/film-information/film-information.component';
import { RateFilmComponent } from './components/rate-film/rate-film.component';
import { FilmsComponent } from './components/films/films.component';
import { EditFilmRatingComponent } from './components/edit-film-rating/edit-film-rating.component';


export const routes: Routes = [
    { path: '', component: LoginRegisterComponent },
    
    { path: 'home', component: HomeComponent },

    { path: 'search', redirectTo: 'search/movies', pathMatch: 'full' },
    { path: 'search/:type', component: SearchComponent },  ///  movies | series | users  \\\
    { path: 'movie/:imdbId', component: FilmInformationComponent },
    { path: 'series/:imdbId', component: FilmInformationComponent },
    { path: 'rate/:type/:imdbId', component: RateFilmComponent },   ///  movies | series  \\\

    { path: 'movies', component: FilmsComponent, data: { kind: 'movie' } },
    { path: 'shows', component: FilmsComponent, data: { kind: 'series' } },

    { path: 'edit/:type/:postId', component: EditFilmRatingComponent },


    { path: '**', redirectTo: '' },
];