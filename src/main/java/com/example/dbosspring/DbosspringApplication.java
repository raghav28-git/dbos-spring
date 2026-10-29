package com.example.dbosspring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DbosspringApplication {
    public static void main(String[] args) {
        SpringApplication.run(DbosspringApplication.class, args);
    }
}