import { Routes } from '@angular/router';
import { LoginRegisterComponent } from './components/login-register/login-register.component';
import { HomeComponent } from './components/home/home.component';
import { SearchComponent } from './components/search/search.component';
import { FilmInformationComponent } from './components/film-information/film-information.component';
import { RateFilmComponent } from './components/rate-film/rate-film.component';
import { EditFilmRatingComponent } from './components/edit-film-rating/edit-film-rating.component';
import { FilmsLibraryComponent } from './components/films-library/films-library.component';
import { FilmsSummaryComponent } from './components/films-summary/films-summary.component';
import { AuthGuard } from './core/auth.guard';
import { PostFilmComponent } from './components/post-film/post-film.component';
import { AccountComponent } from './components/account/account.component';
import { SettingsAccountInfoComponent } from './components/settings-account-info/settings-account-info.component';
import { SettingsPrivacyComponent } from './components/settings-privacy/settings-privacy.component';


export const routes: Routes = [
    { path: '', component: LoginRegisterComponent, pathMatch: 'full' },

    { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },

    { path: 'search', redirectTo: 'search/movies', pathMatch: 'full' },
    { path: 'search/:type', component: SearchComponent, canActivate: [AuthGuard] }, // movies | series | users

    { path: 'movie/:imdbId', component: FilmInformationComponent, canActivate: [AuthGuard] },
    { path: 'series/:imdbId', component: FilmInformationComponent, canActivate: [AuthGuard] },

    { path: 'rate/:type/:imdbId', component: RateFilmComponent, canActivate: [AuthGuard] }, // movies | series

    { path: 'post/:type', component: PostFilmComponent, canActivate: [AuthGuard] }, // movies | series
    
    { path: 'movies/library', component: FilmsLibraryComponent, data: { kind: 'movie' }, canActivate: [AuthGuard] },
    { path: 'movies/summary', component: FilmsSummaryComponent, data: { kind: 'movie' }, canActivate: [AuthGuard] },

    { path: 'shows/library', component: FilmsLibraryComponent, data: { kind: 'series' }, canActivate: [AuthGuard] },
    { path: 'shows/summary', component: FilmsSummaryComponent, data: { kind: 'series' }, canActivate: [AuthGuard] },

    { path: 'edit/:type/:postId', component: EditFilmRatingComponent, canActivate: [AuthGuard] },

    { path: 'account/:username', component: AccountComponent, canActivate: [AuthGuard] },

    { path: 'settings/account-info', component: SettingsAccountInfoComponent, canActivate: [AuthGuard] },
    { path: 'settings/privacy', component: SettingsPrivacyComponent, canActivate: [AuthGuard] },

    // Fallback
    { path: '**', redirectTo: '' },
];