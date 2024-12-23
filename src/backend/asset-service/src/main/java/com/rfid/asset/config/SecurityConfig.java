package com.rfid.asset.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Security configuration class for the Asset Service.
 * Implements comprehensive security settings including JWT authentication,
 * role-based authorization, and security filters.
 * 
 * @version 1.0
 * Spring Security version: 3.0.0
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Secured API paths requiring authentication
    private static final String[] SECURED_PATHS = {
        "/api/v1/assets/**",
        "/api/v1/locations/**",
        "/api/v1/readers/**"
    };

    // Public paths accessible without authentication
    private static final String[] PUBLIC_PATHS = {
        "/actuator/health",
        "/actuator/prometheus",
        "/actuator/info"
    };

    private final String auth0Domain;
    private final String auth0Audience;

    /**
     * Constructor initializing Auth0 configuration properties.
     * 
     * @param auth0Domain The Auth0 domain for JWT validation
     * @param auth0Audience The Auth0 audience for token validation
     */
    public SecurityConfig(String auth0Domain, String auth0Audience) {
        this.auth0Domain = auth0Domain;
        this.auth0Audience = auth0Audience;
    }

    /**
     * Configures the security filter chain with comprehensive security settings.
     * 
     * @param http HttpSecurity instance to configure
     * @return Configured SecurityFilterChain
     * @throws Exception if configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            // Configure CORS
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // Disable CSRF for REST API
            .csrf(csrf -> csrf.disable())
            // Configure stateless session management
            .sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Configure authorization rules
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers(PUBLIC_PATHS).permitAll()
                // Admin role paths
                .requestMatchers("/api/v1/**").hasRole("ADMIN")
                // Asset Manager role paths
                .requestMatchers("/api/v1/assets/**", "/api/v1/locations/**")
                    .hasAnyRole("ADMIN", "ASSET_MANAGER")
                // Operator role paths
                .requestMatchers("/api/v1/assets/view/**", "/api/v1/locations/view/**")
                    .hasAnyRole("ADMIN", "ASSET_MANAGER", "OPERATOR")
                // Viewer role paths
                .requestMatchers("/api/v1/assets/view/**")
                    .hasAnyRole("ADMIN", "ASSET_MANAGER", "OPERATOR", "VIEWER")
                // All other requests need authentication
                .anyRequest().authenticated())
            // Configure OAuth2 resource server with JWT
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder())
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())))
            // Configure exception handling
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(401);
                    response.getWriter().write("Unauthorized");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(403);
                    response.getWriter().write("Access Denied");
                }))
            .build();
    }

    /**
     * Configures JWT decoder for token validation.
     * 
     * @return Configured JwtDecoder
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withJwkSetUri(auth0Domain + "/.well-known/jwks.json")
            .build();
    }

    /**
     * Configures JWT authentication converter for role mapping.
     * 
     * @return Configured JwtAuthenticationConverter
     */
    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(
            jwt -> jwt.getClaimAsStringList("permissions").stream()
                .map(permission -> "ROLE_" + permission.toUpperCase())
                .map(role -> (org.springframework.security.core.GrantedAuthority) 
                    () -> role)
                .toList()
        );
        return converter;
    }

    /**
     * Configures CORS settings for cross-origin requests.
     * 
     * @return Configured CorsConfigurationSource
     */
    private CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("*")); // Configure based on environment
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type"));
        configuration.setExposedHeaders(Arrays.asList("X-Total-Count"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}