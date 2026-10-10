<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
        $this->get('/admin')->assertRedirect('/login');
    }

    public function test_dashboard_alias_redirects_to_admin_dashboard(): void
    {
        $this->actingAs(User::factory()->create());

        $this->get('/dashboard')->assertRedirect('/admin');
    }

    public function test_every_panel_role_can_open_the_admin_dashboard(): void
    {
        foreach (['admin', 'guru', 'proktor'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $this->get('/admin')->assertOk();
        }
    }

    public function test_inactive_panel_user_is_blocked_by_role_middleware(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin', 'is_active' => false]));

        $this->get('/admin/students')->assertForbidden();
    }

    public function test_public_registration_is_disabled(): void
    {
        $this->get('/register')->assertNotFound();
    }
}
