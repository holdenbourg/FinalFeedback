import { Routes } from '@angular/router';
import { LoginRegisterComponent } from './components/login-register/login-register.component';
import { HomeComponent } from './components/home/home.component';
import { SearchComponent } from './components/search/search.component';

export const routes: Routes = [
    { path: '', component: LoginRegisterComponent },
    { path: 'home', component: HomeComponent },
    { path: 'search', redirectTo: 'search/movies', pathMatch: 'full' },
    { path: 'search/:type', component: SearchComponent },  ///  movies | series | users  \\\

    { path: '**', redirectTo: '' },
];
