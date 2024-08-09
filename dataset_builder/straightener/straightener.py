import pygame
from pygame.locals import *
from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *
from PIL import Image
import sys

import numpy as np

# Vertex Shader
vertex_shader_src = """
#version 330 core
layout(location = 0) in vec2 inPosition;
layout(location = 1) in vec2 inTexCoord;

out vec2 texCoord;

void main()
{
    gl_Position = vec4(inPosition, 0.0, 1.0);
    texCoord = inTexCoord;
}
"""

# Fragment Shader
fragment_shader_src = """
#version 330 core
in vec2 texCoord;
out vec4 outColor;

uniform sampler2D textureSampler;
uniform vec3 lineColor;

uniform mat3 R;

// Function to transform texture coordinates to Cartesian coordinates on a sphere with radius 1
vec3 texCoordToSphere(vec2 coord) {
    // Convert texture coordinates [0, 1] to [-1, 1]
    vec2 normalizedCoord = coord * 2.0 - 1.0;

    // Convert normalized coordinates to spherical coordinates
    float latitude = normalizedCoord.y * (3.141592653589793 / 2.0); // Latitude: -pi/2 to pi/2
    float longitude = normalizedCoord.x * 3.141592653589793; // Longitude: -pi to pi

    // Cartesian coordinates
    float x = cos(latitude) * cos(longitude);
    float y = sin(latitude);
    float z = cos(latitude) * sin(longitude);

    return R*vec3(x, y, z);
}

// Function to transform Cartesian coordinates on a sphere with radius 1 to texture coordinates
vec2 sphereToTexCoord(vec3 sphereCoord) {
    // Normalize the sphere coordinates
    vec3 normCoord = normalize(sphereCoord);

    // Calculate latitude and longitude
    float latitude = atan( normCoord.y,sqrt(normCoord.x*normCoord.x+normCoord.z*normCoord.z)); // Latitude in range [-pi/2, pi/2]
    float longitude = atan(normCoord.z, normCoord.x); // Longitude in range [-pi, pi]

    // Convert to texture coordinates [0, 1]
    float u = (longitude / 3.141592653589793*0.5 + 0.5);
    float v = (latitude / (3.141592653589793 / 2.0) *0.5+ 0.5);

    return vec2(u, v);
}

void main()
{
    vec2 coord = texCoord;
    vec3 coord3d = texCoordToSphere(coord);
    vec2 coord_T = sphereToTexCoord(coord3d);
    
    // For the quad, we use the texture
    if (texture(textureSampler, texCoord).a > 0.0)
        outColor = texture(textureSampler, coord_T);
    else
        outColor = vec4(lineColor, 1.0); // For the lines, we use the uniform color
     
}
"""
# Define a 3x3 matrix of ones
R = np.eye(3, 3)

def load_image(image_path):
    image = Image.open(image_path)
    image = image.transpose(Image.FLIP_TOP_BOTTOM)
    img_data = image.convert("RGBA").tobytes()
    return image.size, img_data

def compile_shader(shader_type, source):
    shader = glCreateShader(shader_type)
    glShaderSource(shader, source)
    glCompileShader(shader)
    if not glGetShaderiv(shader, GL_COMPILE_STATUS):
        error = glGetShaderInfoLog(shader).decode()
        raise RuntimeError(f"Shader compilation failed: {error}")
    return shader

def create_shader_program():
    vertex_shader = compile_shader(GL_VERTEX_SHADER, vertex_shader_src)
    fragment_shader = compile_shader(GL_FRAGMENT_SHADER, fragment_shader_src)
    
    program = glCreateProgram()
    glAttachShader(program, vertex_shader)
    glAttachShader(program, fragment_shader)
    glLinkProgram(program)
    
    if not glGetProgramiv(program, GL_LINK_STATUS):
        error = glGetProgramInfoLog(program).decode()
        raise RuntimeError(f"Program linking failed: {error}")
    
    glDeleteShader(vertex_shader)
    glDeleteShader(fragment_shader)
    
    return program

def init_opengl(image_size, img_data):
    glClearColor(0.0, 0.0, 0.0, 0.0)
    glClearDepth(1.0)
    glDepthFunc(GL_LEQUAL)
    glEnable(GL_DEPTH_TEST)
    glShadeModel(GL_SMOOTH)
    
    tex = glGenTextures(1)
    print(tex)
    glBindTexture(GL_TEXTURE_2D, tex)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, image_size[0], image_size[1], 0, GL_RGBA, GL_UNSIGNED_BYTE, img_data)

    program = create_shader_program()
    glUseProgram(program)
    
    quad_vertices = [
        -1.0, -1.0, 0.0, 0.0,
         1.0, -1.0, 1.0, 0.0,
         1.0,  1.0, 1.0, 1.0,
        -1.0,  1.0, 0.0, 1.0
    ]
    quad_vertices = (GLfloat * len(quad_vertices))(*quad_vertices)

    vao = glGenVertexArrays(1)
    vbo = glGenBuffers(1)

    glBindVertexArray(vao)
    glBindBuffer(GL_ARRAY_BUFFER, vbo)
    glBufferData(GL_ARRAY_BUFFER, len(quad_vertices) * 4, quad_vertices, GL_STATIC_DRAW)

    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * 4, ctypes.c_void_p(0))
    glEnableVertexAttribArray(0)

    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * 4, ctypes.c_void_p(2 * 4))
    glEnableVertexAttribArray(1)

    glBindBuffer(GL_ARRAY_BUFFER, 0)
    glBindVertexArray(0)

    return program, vao, tex

def create_fbo(image_size):
    width, height = image_size
      
    # Create Frame Buffer Object (FBO)
    fbo = glGenFramebuffers(1)
    glBindFramebuffer(GL_FRAMEBUFFER, fbo)
    
    # Create a texture to render to
    texture = glGenTextures(1)
    print(texture)
    
    glBindTexture(GL_TEXTURE_2D, texture)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, None)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
    
    # Attach texture to FBO
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, texture, 0)
 
    # Check FBO status
    if glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE:
        raise RuntimeError("Framebuffer is not complete")

    # Unbind FBO
    glBindFramebuffer(GL_FRAMEBUFFER, 0)

    return fbo, texture

def render_to_fbo(fbo, program, vao,width, height,tex):
    # Bind the FBO
    glBindFramebuffer(GL_FRAMEBUFFER, fbo)
    glViewport(0, 0, width, height)  # Set the viewport to the size of the FBO
    
    # Render to the FBO
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    draw_quad(program, vao,tex)
    
    # Unbind the FBO
    glBindFramebuffer(GL_FRAMEBUFFER, 0)

def save_fbo_image(texture, image_size, output_path):
    width, height = image_size
    glBindTexture(GL_TEXTURE_2D, texture)
    
    # Read the pixels from the texture
    pixels = glGetTexImage(GL_TEXTURE_2D, 0, GL_RGB, GL_UNSIGNED_BYTE)
    
    # Save the image using PIL
    image = Image.frombytes("RGB", image_size, pixels)
    image = image.transpose(Image.FLIP_TOP_BOTTOM)  # Flip vertically
    image.save(output_path)
    
def draw_quad(program, vao,tex):

    # Uniform location for R
    R_location = glGetUniformLocation(program, "R")
#    print(R_location)
    glUniformMatrix3fv(R_location, 1, GL_FALSE, R)
 #  print(R)
    
    glBindTexture(GL_TEXTURE_2D, tex)
    glBindVertexArray(vao)
    glDrawArrays(GL_QUADS, 0, 4)
    glBindVertexArray(0)

def draw_lines(program, click_positions):
    glLineWidth(2.0)
    
    # Uniform location for color
    line_color_location = glGetUniformLocation(program, "lineColor")

    # Draw the first line in blue
    if click_positions[0] and click_positions[1]:
        glUniform3f(line_color_location, 0.0, 0.0, 1.0)  # Blue color
        glBegin(GL_LINES)
        glVertex2f(click_positions[0][0], click_positions[0][1])
        glVertex2f(click_positions[1][0], click_positions[1][1])
        glEnd()

    # Draw the second line in green
    if click_positions[2] and click_positions[3]:
        glUniform3f(line_color_location, 0.0, 1.0, 0.0)  # Green color
        glBegin(GL_LINES)
        glVertex2f(click_positions[2][0], click_positions[2][1])
        glVertex2f(click_positions[3][0], click_positions[3][1])
        glEnd()

def vector_to_rotation_matrix(v):
    """
    Create a 3x3 rotation matrix that rotates vector `v` to align with the vector [0, 1, 0].
    
    Parameters:
    v: A 3D numpy array or list representing the vector to rotate.
    
    Returns:
    A 3x3 numpy array representing the rotation matrix.
    """
    # Ensure v is a numpy array and normalize it
    v = np.array(v, dtype=np.float64)
    v /= np.linalg.norm(v)
    
    # The target vector we want to align with
    target = np.array([0.0, 1.0, 0.0])
    
    # Compute the rotation axis (cross product) and angle (dot product)
    axis = np.cross(v, target)
    angle = np.arccos(np.clip(np.dot(v, target), -1.0, 1.0))  # Clip value to avoid numerical errors
    
    # If the rotation axis is zero, it means the vectors are already aligned
    if np.linalg.norm(axis) < 1e-6:
        return np.eye(3)  # Return identity matrix
    
    # Normalize the axis vector
    axis /= np.linalg.norm(axis)
    
    # Compute the rotation matrix using Rodrigues' rotation formula
    K = np.array([[0, -axis[2], axis[1]],
                  [axis[2], 0, -axis[0]],
                  [-axis[1], axis[0], 0]])
    
    I = np.eye(3)
    R = I + np.sin(angle) * K + (1 - np.cos(angle)) * np.dot(K, K)
    
    return R
 
def handle_keyboard_event(event, click_positions):
    """
    Handle keyboard events to clear the click positions when the spacebar is pressed.
    
    Parameters:
    event: The Pygame event object.
    click_positions: The list of click positions to be modified.
    """
    global R
    if event.type == pygame.KEYDOWN:
        if event.key == pygame.K_SPACE:
            # Clear click positions if spacebar is pressed
            print("Clearing click positions")
            a0 = equirectangular_to_sphere(click_positions[0][0],click_positions[0][1]) 
            a1 = equirectangular_to_sphere(click_positions[1][0],click_positions[1][1]) 
            b0 = equirectangular_to_sphere(click_positions[2][0],click_positions[2][1]) 
            b1 = equirectangular_to_sphere(click_positions[3][0],click_positions[3][1]) 
            
            a = np.cross(a0,a1)
            b = np.cross(b0,b1)
            
            v = np.cross(a,b)
             
            R =  vector_to_rotation_matrix(v)
            print(R)
            
        if event.key == pygame.K_z:
            R = np.eye(3,3)	

   
def main(image_path):
    image_size, img_data = load_image(image_path)

    width, height = image_size
    aspect_ratio = width / height

    pygame.init()
    window_size = (int(800 * aspect_ratio), 800) if aspect_ratio > 1 else (800, int(800 / aspect_ratio))
    pygame.display.set_mode(window_size, DOUBLEBUF | OPENGL)
    pygame.display.set_caption("OpenGL Texture")

    program, vao,tex = init_opengl(image_size, img_data)

    # Initialize a list to store 4 positions, starting as None
    click_positions = [None, None, None, None]
    current_index = 0

    # Create FBO
    fbo, tex_fbo = create_fbo(image_size)
    
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            if event.type == pygame.MOUSEBUTTONDOWN:
                x, y = pygame.mouse.get_pos()
                # Store the normalized coordinates (from -1 to 1)
                normalized_x = (x / window_size[0]) * 2 - 1
                normalized_y = -((y / window_size[1]) * 2 - 1)  # Flip y-axis for OpenGL
                click_positions[current_index] = (normalized_x, normalized_y)
                current_index = (current_index + 1) % 4  # Cycle the index

                print(f"Mouse click at: {click_positions}")

                # Handle keyboard events
            handle_keyboard_event(event, click_positions)
            
            if event.type == pygame.KEYDOWN:
               if event.key == pygame.K_s:
                   # Render to the FBO
                   render_to_fbo(fbo, program, vao,width,height,tex)

                   # Save the rendered image
                   save_fbo_image(tex_fbo, image_size, "rect/"+image_path)


        glViewport(0, 0, window_size[0], window_size[1])   
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        draw_quad(program, vao,tex)
        draw_lines(program, click_positions)  # Draw the lines between the stored positions
        pygame.display.flip()
        pygame.time.wait(10)


      
    pygame.quit()



def equirectangular_to_sphere(x, y):
    # Convert normalized coordinates [-1, 1] to [-pi, pi] and [-pi/2, pi/2]
    longitude = x * np.pi
    latitude = y * (np.pi / 2)

    # Convert spherical coordinates to Cartesian coordinates
    # Radius of the sphere is 1
    sphere_x = np.cos(latitude) * np.cos(longitude)
    sphere_y = np.sin(latitude)
    sphere_z = np.cos(latitude) * np.sin(longitude)

    return np.array((sphere_x, sphere_y, sphere_z))
    
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py <path_to_image>")
        sys.exit(1)

    image_path = sys.argv[1]
    main(image_path)

